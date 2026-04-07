import json
import re
import threading
import uuid
from flask import Flask, request, jsonify
from flask_sock import Sock

app = Flask(__name__)
sock = Sock(app)

# ── State ────────────────────────────────────────────────────────────────────
ws_client = None          # the single connected extension WS
ws_lock = threading.Lock()

pending = {}              # requestId → {'event': Event, 'result': dict}
pending_lock = threading.Lock()

# ── WebSocket endpoint (extension connects here) ─────────────────────────────
@sock.route('/ws')
def websocket(ws):
    global ws_client
    with ws_lock:
        ws_client = ws
    print('[WS] Extension connected')
    try:
        while True:
            raw = ws.receive()
            if raw is None:
                break
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            req_id = msg.get('requestId')
            if req_id:
                with pending_lock:
                    if req_id in pending:
                        pending[req_id]['result'] = msg
                        pending[req_id]['event'].set()
    finally:
        with ws_lock:
            if ws_client is ws:
                ws_client = None
        print('[WS] Extension disconnected')


# ── Property path helper ──────────────────────────────────────────────────────
def resolve_property(data, prop_path):
    """Navigate data using bracket notation like ["box"]["width"]."""
    keys = re.findall(r'\["([^"]+)"\]', prop_path)
    if not keys:
        return None, f'Invalid property path: {prop_path!r} — use ["key"]["subkey"] notation'
    result = data
    for key in keys:
        if isinstance(result, dict) and key in result:
            result = result[key]
        else:
            return None, f'Property not found: {prop_path!r}'
    return result, None


# ── POST /inspect ─────────────────────────────────────────────────────────────
@app.post('/inspect')
def inspect():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({'error': 'Request body must be JSON'}), 400

    url = body.get('url', '').strip()
    selector = body.get('path', '').strip()

    if not url:
        return jsonify({'error': 'Missing field: url'}), 400
    if not selector:
        return jsonify({'error': 'Missing field: path'}), 400

    with ws_lock:
        client = ws_client

    if client is None:
        return jsonify({'error': 'No extension connected – open Chrome with the extension installed'}), 503

    req_id = str(uuid.uuid4())
    event = threading.Event()
    with pending_lock:
        pending[req_id] = {'event': event, 'result': None}

    try:
        client.send(json.dumps({
            'type': 'inspect',
            'requestId': req_id,
            'url': url,
            'selector': selector,
        }))
    except Exception as exc:
        with pending_lock:
            pending.pop(req_id, None)
        return jsonify({'error': f'Failed to send to extension: {exc}'}), 500

    # Wait up to 30 s for the extension to reply
    if not event.wait(timeout=60):
        with pending_lock:
            pending.pop(req_id, None)
        return jsonify({'error': 'Timeout: extension did not respond within 60 s'}), 504

    with pending_lock:
        msg = pending.pop(req_id)['result']

    if msg.get('type') == 'error':
        return jsonify({'error': msg.get('error', 'Unknown error from extension')}), 404

    data = msg.get('data', {})

    prop = body.get('property', '').strip()
    if prop:
        value, err = resolve_property(data, prop)
        if err:
            return jsonify({'error': err}), 404
        return jsonify(value)

    return jsonify(data)


# ── POST /reload ─────────────────────────────────────────────────────────────
@app.post('/reload')
def reload_tab():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({'error': 'Request body must be JSON'}), 400

    url = body.get('url', '').strip()
    if not url:
        return jsonify({'error': 'Missing field: url'}), 400

    with ws_lock:
        client = ws_client

    if client is None:
        return jsonify({'error': 'No extension connected – open Chrome with the extension installed'}), 503

    req_id = str(uuid.uuid4())
    event = threading.Event()
    with pending_lock:
        pending[req_id] = {'event': event, 'result': None}

    try:
        client.send(json.dumps({
            'type': 'reload',
            'requestId': req_id,
            'url': url,
        }))
    except Exception as exc:
        with pending_lock:
            pending.pop(req_id, None)
        return jsonify({'error': f'Failed to send to extension: {exc}'}), 500

    if not event.wait(timeout=60):
        with pending_lock:
            pending.pop(req_id, None)
        return jsonify({'error': 'Timeout: extension did not respond within 60 s'}), 504

    with pending_lock:
        msg = pending.pop(req_id)['result']

    if msg.get('type') == 'error':
        return jsonify({'error': msg.get('error', 'Unknown error from extension')}), 400

    return jsonify({'message': 'loaded', 'title': msg.get('title', '')})


# ── POST /execute ────────────────────────────────────────────────────────────
@app.post('/execute')
def execute():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({'error': 'Request body must be JSON'}), 400

    url = body.get('url', '').strip()
    script = body.get('script', '').strip()

    if not url:
        return jsonify({'error': 'Missing field: url'}), 400
    if not script:
        return jsonify({'error': 'Missing field: script'}), 400

    with ws_lock:
        client = ws_client

    if client is None:
        return jsonify({'error': 'No extension connected – open Chrome with the extension installed'}), 503

    req_id = str(uuid.uuid4())
    event = threading.Event()
    with pending_lock:
        pending[req_id] = {'event': event, 'result': None}

    try:
        client.send(json.dumps({
            'type': 'execute',
            'requestId': req_id,
            'url': url,
            'script': script,
        }))
    except Exception as exc:
        with pending_lock:
            pending.pop(req_id, None)
        return jsonify({'error': f'Failed to send to extension: {exc}'}), 500

    if not event.wait(timeout=60):
        with pending_lock:
            pending.pop(req_id, None)
        return jsonify({'error': 'Timeout: extension did not respond within 60 s'}), 504

    with pending_lock:
        msg = pending.pop(req_id)['result']

    if msg.get('type') == 'error':
        return jsonify({'error': msg.get('error', 'Unknown error from extension'), 'logs': msg.get('logs', [])}), 400

    return jsonify(msg.get('data', {}))


# ── Health check ──────────────────────────────────────────────────────────────
@app.get('/status')
def status():
    return jsonify({'connected': ws_client is not None})


if __name__ == '__main__':
    print('Style Inspector server → http://localhost:5001')
    print('WebSocket            → ws://localhost:5001/ws')
    app.run(host='0.0.0.0', port=5001, debug=False)
