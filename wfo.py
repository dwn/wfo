#!/usr/bin/env python3

"""
Simple WFO HTML Server with Hot Reloading using FastAPI
This script loads environment variables from .env file and serves wfo.html
with proper Supabase configuration substitution and automatic reloading.
"""

import os
import re
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

class WFOServer:
    """WFO Server with hot reloading using FastAPI"""
    
    def __init__(self):
        self.app = FastAPI(title="WFO Server", description="WFO HTML Server with Hot Reloading")
        self.port = 8080
        self.original_dir = Path.cwd()
        self.supabase_url = None
        self.service_key = None
        
        # Setup routes
        self.setup_routes()
        
    def load_env_vars(self):
        """Load environment variables from .env file"""
        env_file = Path('.env')
        
        if env_file.exists():
            print("📄 Loading environment variables from .env file...")
            with open(env_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        # Remove quotes if present
                        value = value.strip('"\'')
                        os.environ[key] = value
        else:
            print("⚠️  Warning: No .env file found. Using default values.")
            print("   Create a .env file with:")
            print("   LOCAL_SUPABASE_URL=http://localhost:54321")
            print("   LOCAL_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key")
            print()
            
        # Set variables with defaults
        self.supabase_url = os.environ.get('LOCAL_SUPABASE_URL', 'http://localhost:54321')
        self.service_key = os.environ.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY', '')
        
    def find_available_port(self):
        """Find an available port starting from 8080"""
        import socket
        port = 8080
        while port < 9000:  # reasonable upper limit
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(('localhost', port))
                    self.port = port
                    break
            except OSError:
                port += 1
        else:
            raise RuntimeError("Could not find an available port")
                
    def process_html_file(self, filename='wfo.html'):
        """Process HTML file with environment variable substitution"""
        source_file = self.original_dir / filename
        
        if not source_file.exists():
            print(f"❌ Error: {source_file} not found!")
            return None
            
        # Reload environment variables on each request to ensure they're fresh
        self.load_env_vars()
            
        print(f"🔄 Processing {filename}...")
        print(f"📁 Source: {source_file}")
        
        # Read the source file
        with open(source_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Replace environment variables
        content = re.sub(
            r"const SUPABASE_URL = '{{SUPABASE_URL}}'",
            f"const SUPABASE_URL = '{self.supabase_url}'",
            content
        )
        
        content = re.sub(
            r"const SUPABASE_SERVICE_ROLE_KEY = '{{SUPABASE_SERVICE_ROLE_KEY}}'",
            f"const SUPABASE_SERVICE_ROLE_KEY = '{self.service_key}'",
            content
        )
        
        content = re.sub(
            r"`{{SUPABASE_URL}}/storage/v1/object/public/card/`",
            f"`{self.supabase_url}/storage/v1/object/public/card/`",
            content
        )
        
        print("✅ File processed successfully")
        return content
        
    def setup_routes(self):
        """Setup FastAPI routes"""
        
        @self.app.get("/", response_class=HTMLResponse)
        async def serve_wfo():
            content = self.process_html_file('wfo.html')
            if content is None:
                return HTMLResponse("<h1>Error: File not processed</h1>", status_code=500)
            return HTMLResponse(content)
        
        # Serve static files from the original directory
        for static_dir in ["static", "css", "js", "images", "lib"]:
            if (self.original_dir / static_dir).exists():
                self.app.mount(f"/{static_dir}", StaticFiles(directory=str(self.original_dir / static_dir)), name=static_dir)
        
        # Serve root directory files (for wfo.css, wfo.js, etc.)
        from fastapi.responses import FileResponse
        import mimetypes
        
        @self.app.get("/{filename}")
        async def serve_root_files(filename: str):
            file_path = self.original_dir / filename
            if file_path.exists() and file_path.is_file():
                # Determine content type
                content_type, _ = mimetypes.guess_type(str(file_path))
                
                # If it's a JS file, process template variables
                if filename.endswith('.js'):
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                        
                        # Replace environment variables
                        content = re.sub(
                            r"const SUPABASE_URL = '{{SUPABASE_URL}}'",
                            f"const SUPABASE_URL = '{self.supabase_url}'",
                            content
                        )
                        
                        content = re.sub(
                            r"const SUPABASE_SERVICE_ROLE_KEY = '{{SUPABASE_SERVICE_ROLE_KEY}}'",
                            f"const SUPABASE_SERVICE_ROLE_KEY = '{self.service_key}'",
                            content
                        )
                        
                        content = re.sub(
                            r"`{{SUPABASE_URL}}/storage/v1/object/public/card/`",
                            f"`{self.supabase_url}/storage/v1/object/public/card/`",
                            content
                        )
                        
                        return HTMLResponse(content, media_type=content_type)
                    except Exception as e:
                        return HTMLResponse(f"Error processing JS file: {str(e)}", status_code=500)
                else:
                    return FileResponse(str(file_path), media_type=content_type)
            else:
                return {"error": "File not found"}
        
    def run(self):
        """Main run method"""
        # Load environment variables
        self.load_env_vars()
        
        print("🚀 Starting WFO HTML Server with FastAPI...")
        print(f"📡 Supabase URL: {self.supabase_url}")
        if self.service_key:
            print(f"🔑 Service Key: {'*' * len(self.service_key)}")
        else:
            print("🔑 Service Key: Not set")
            
        # Find available port
        self.find_available_port()
        print(f"🌐 Server will be available at: http://localhost:{self.port}")
        print(f"📄 WFO page: http://localhost:{self.port}/")
        print("   Press Ctrl+C to stop the server")
        print()
        
        # Check if wfo.html exists
        if not (self.original_dir / 'wfo.html').exists():
            print("❌ Error: wfo.html file not found in current directory")
            return 1
            
        # Start FastAPI server with hot reloading
        print(f"🌐 FastAPI server starting on http://localhost:{self.port}")
        print("🔥 Hot reloading enabled - changes to HTML files will be reflected immediately!")
        
        uvicorn.run(
            "serve_wfo:app",  # Import string for reload mode
            host="localhost",
            port=self.port,
            reload=True,  # This enables hot reloading!
            log_level="warning",  # Reduce log noise
            access_log=False     # Disable access logs
        )
        
        return 0

# Create the FastAPI app instance for uvicorn reload mode
server = WFOServer()
app = server.app

def main():
    """Main entry point"""
    return server.run()

if __name__ == '__main__':
    import sys
    sys.exit(main())