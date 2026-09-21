"""
Library Borrowing Desk Simulation - UI Launcher
Case B - Group 3: Cervantes, Miko et al.
"""

import http.server
import socketserver
import webbrowser
import os
import sys
import threading
import time

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # Suppress routine log chatter
        pass

def start_server():
    # Allow port reuse
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print("=" * 60)
            print("   LIBRARY BORROWING DESK - VISUAL SIMULATION UI")
            print("   Case B - Group 3 (Modelling & Simulation Midterm V1)")
            print("=" * 60)
            print(f"\n[+] Local Server running at: http://localhost:{PORT}")
            print("[+] Opening web browser automatically...")
            print("[+] Press Ctrl+C in this terminal to stop the server.\n")
            httpd.serve_forever()
    except OSError:
        # Fallback to direct file opening if port 8000 is occupied
        print(f"[!] Port {PORT} is busy, opening file directly in browser...")
        file_path = os.path.join(DIRECTORY, "index.html")
        webbrowser.open(f"file://{file_path}")

def open_browser():
    time.sleep(1.0)
    webbrowser.open(f"http://localhost:{PORT}")

if __name__ == "__main__":
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()
    try:
        start_server()
    except KeyboardInterrupt:
        print("\n[+] Simulation server stopped. Goodbye!")
        sys.exit(0)
