from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
import sqlite3
import os
import time
from datetime import datetime

# ------------------ App setup ------------------
app = Flask(__name__, instance_relative_config=True)
CORS(app)

DB_PATH = os.path.join(app.instance_path, 'animal_feeder.db')

# ------------------ Database helper ------------------
def query_db(query, args=(), one=False):
    con = None
    try:
        con = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
        con.row_factory = sqlite3.Row
        cur = con.cursor()
        cur.execute(query, args)
        rv = cur.fetchall()
        con.commit()
        return (rv[0] if rv else None) if one else rv
    except sqlite3.OperationalError as e:
        if con:
            con.rollback()
        raise e
    finally:
        if con:
            con.close()

os.makedirs(app.instance_path, exist_ok=True)

# ------------------ Table creation ------------------
query_db("""
CREATE TABLE IF NOT EXISTS camera (
    cam_id TEXT PRIMARY KEY,
    status TEXT NOT NULL
)
""")

query_db("""
CREATE TABLE IF NOT EXISTS modules (
    module_id TEXT PRIMARY KEY,
    cam_id TEXT NOT NULL,
    status TEXT NOT NULL,
    weight REAL,
    FOREIGN KEY (cam_id) REFERENCES camera(cam_id)
)
""")

query_db("""
CREATE TABLE IF NOT EXISTS schedules (
    schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id TEXT NOT NULL,
    feed_time TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'done')),
    FOREIGN KEY (module_id) REFERENCES modules(module_id)
)
""")

query_db("""
CREATE TABLE IF NOT EXISTS history (
    history_id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id)
)
""")

# ------------------ ESP32/DEVICE ROUTES ------------------
@app.route("/health")
def health_check():
    """mDNS/health check endpoint for devices"""
    return "mDNS OK"

@app.route("/check_sched", methods=["GET"])
def check_sched():
    """Check if a device should dispense food now"""
    device_id = request.args.get("device_id")
    
    if not device_id:
        return jsonify({"error": "Missing device_id"}), 400
    
    # Get current time in HH:MM format
    now = datetime.now().strftime("%H:%M")
    
    # Check for pending schedules at current time
    row = query_db("""
        SELECT schedule_id, amount FROM schedules
        WHERE module_id=? AND feed_time=? AND status='pending'
    """, (device_id, now), one=True)
    
    if row:
        # Mark schedule as done
        query_db("""
            UPDATE schedules SET status='done' WHERE schedule_id=?
        """, (row['schedule_id'],))
        
        # Add to history
        query_db("""
            INSERT INTO history (schedule_id) VALUES (?)
        """, (row['schedule_id'],))
        
        return jsonify({
            "dispense": True, 
            "amount": row['amount'],
            "schedule_id": row['schedule_id']
        })
    else:
        return jsonify({"dispense": False})

@app.route("/weight_update", methods=["POST"])
def weight_update():
    """Update module weight from ESP32"""
    device_id = request.form.get("device_id")
    weight = request.form.get("weight")
    
    if not device_id or weight is None:
        return jsonify({"error": "Missing device_id or weight"}), 400
    
    print(f"Weight update - Device: {device_id}, Weight: {weight}")
    
    # Check if module exists
    existing = query_db("""
        SELECT module_id FROM modules WHERE module_id=?
    """, (device_id,), one=True)
    
    if existing:
        # Update existing module
        query_db("""
            UPDATE modules SET weight=?, status='active' WHERE module_id=?
        """, (float(weight), device_id))
    else:
        # Insert new module (assign to first available camera or default)
        cam_result = query_db("SELECT cam_id FROM camera LIMIT 1", one=True)
        cam_id = cam_result['cam_id'] if cam_result else "CAMERA01"
        
        query_db("""
            INSERT INTO modules (module_id, cam_id, status, weight)
            VALUES (?, ?, 'active', ?)
        """, (device_id, cam_id, float(weight)))
    
    return jsonify({
        "success": True,
        "message": f"Weight updated for {device_id}: {weight}g"
    })

@app.route("/upload_image", methods=["POST"])
def upload_image():
    """Receive image from ESP32-CAM"""
    image = request.data
    
    if not image:
        return jsonify({"error": "No image data"}), 400
    
    # Create images directory if it doesn't exist
    images_dir = os.path.join(app.instance_path, 'images')
    os.makedirs(images_dir, exist_ok=True)
    
    # Save with timestamp
    filename = f"cam_{int(time.time())}.jpg"
    filepath = os.path.join(images_dir, filename)
    
    with open(filepath, "wb") as f:
        f.write(image)
    
    print(f"Saved: {filename}, Size: {len(image)} bytes")
    
    return jsonify({
        "success": True,
        "filename": filename,
        "size": len(image)
    }), 200

# ------------------ CAMERA ROUTES ------------------
@app.route("/cameras", methods=["GET"])
def get_cameras():
    rows = query_db("SELECT * FROM camera")
    return jsonify([dict(row) for row in rows])

@app.route("/cameras", methods=["POST"])
def add_camera():
    data = request.get_json()
    query_db("INSERT INTO camera (cam_id, status) VALUES (?, ?)",
             (data["cam_id"], data["status"]))
    return jsonify({"success": True})

@app.route("/cameras/<cam_id>", methods=["PUT"])
def update_camera(cam_id):
    data = request.get_json()
    query_db("UPDATE camera SET status = ? WHERE cam_id = ?",
             (data["status"], cam_id))
    return jsonify({"success": True})

@app.route("/cameras/<cam_id>", methods=["DELETE"])
def delete_camera(cam_id):
    query_db("DELETE FROM camera WHERE cam_id = ?", (cam_id,))
    return jsonify({"success": True})

# ------------------ MODULE ROUTES ------------------
@app.route("/modules", methods=["GET"])
def get_modules():
    rows = query_db("SELECT * FROM modules")
    return jsonify([dict(row) for row in rows])

@app.route("/modules", methods=["POST"])
def add_module():
    data = request.get_json()
    query_db("""
        INSERT INTO modules (module_id, cam_id, status, weight)
        VALUES (?, ?, ?, ?)
    """, (data["module_id"], data["cam_id"], data["status"], data["weight"]))
    return jsonify({"success": True})

@app.route("/modules/<module_id>", methods=["PUT"])
def update_module(module_id):
    data = request.get_json()
    query_db("""
        UPDATE modules
        SET cam_id = ?, status = ?, weight = ?
        WHERE module_id = ?
    """, (data["cam_id"], data["status"], data["weight"], module_id))
    return jsonify({"success": True})

@app.route("/modules/<module_id>", methods=["DELETE"])
def delete_module(module_id):
    query_db("DELETE FROM modules WHERE module_id = ?", (module_id,))
    return jsonify({"success": True})

# ------------------ SCHEDULE ROUTES ------------------
@app.route("/schedules", methods=["GET"])
def get_schedules():
    rows = query_db("SELECT * FROM schedules")
    return jsonify([dict(row) for row in rows])

@app.route("/schedules", methods=["POST"])
def add_schedule():
    data = request.get_json()
    query_db("""
        INSERT INTO schedules (module_id, feed_time, amount, status)
        VALUES (?, ?, ?, ?)
    """, (data["module_id"], data["feed_time"], data["amount"], data.get("status", "pending")))
    return jsonify({"success": True})

@app.route("/schedules/<int:schedule_id>", methods=["PUT"])
def update_schedule(schedule_id):
    data = request.get_json()
    query_db("""
        UPDATE schedules
        SET module_id = ?, feed_time = ?, amount = ?, status = ?
        WHERE schedule_id = ?
    """, (data["module_id"], data["feed_time"], data["amount"], data["status"], schedule_id))
    return jsonify({"success": True})

@app.route("/schedules/<int:schedule_id>", methods=["DELETE"])
def delete_schedule(schedule_id):
    query_db("DELETE FROM schedules WHERE schedule_id = ?", (schedule_id,))
    return jsonify({"success": True})

# ------------------ HISTORY ROUTES ------------------
@app.route("/history", methods=["GET"])
def get_history():
    rows = query_db("""
        SELECT h.history_id, h.created_at, s.schedule_id, s.module_id, s.feed_time, s.amount, s.status
        FROM history h
        LEFT JOIN schedules s ON h.schedule_id = s.schedule_id
        ORDER BY h.created_at DESC
    """)
    return jsonify([dict(row) for row in rows])

@app.route("/history", methods=["POST"])
def add_history():
    data = request.get_json()
    query_db("INSERT INTO history (schedule_id) VALUES (?)",
             (data["schedule_id"],))
    return jsonify({"success": True})

@app.route("/history/<int:history_id>", methods=["DELETE"])
def delete_history(history_id):
    query_db("DELETE FROM history WHERE history_id = ?", (history_id,))
    return jsonify({"success": True})

# ------------------ FRONTEND ROUTES ------------------
@app.route("/")
def serve_index():
    return render_template("index.html")

@app.route("/module.html")
def serve_module():
    return render_template("module.html")

@app.route("/schedule.html")
def serve_schedule():
    return render_template("schedule.html")

@app.route("/history.html")
def serve_history():
    return render_template("history.html")

@app.route("/feeders.html")
def serve_feeders():
    return render_template("feeders.html")

# ------------------ Run App ------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, threaded=True)