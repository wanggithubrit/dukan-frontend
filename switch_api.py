import os
import sys

def replace_in_files(target_ip):
    production_url = 'https://dukan-backend-0cc9.onrender.com'
    app_dir = '/Users/npenwang/project_dukan/dukan_app'
    count = 0

    print(f"🔄 Swapping backend endpoints to: {target_ip}")
    for root, dirs, files in os.walk(app_dir):
        if 'node_modules' in root or '.expo' in root or '.git' in root:
            continue
        for file in files:
            if file.endswith('.js') or file.endswith('.json'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    
                    current_local = 'http://localhost:8000'
                    current_emulator = 'http://10.0.2.2:8000'
                    
                    new_content = content
                    if production_url in content and target_ip != production_url:
                        new_content = content.replace(production_url, target_ip)
                    elif current_local in content:
                        new_content = content.replace(current_local, target_ip)
                    elif current_emulator in content:
                        new_content = content.replace(current_emulator, target_ip)
                        
                    if new_content != content:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f"  ✅ Updated: {os.path.relpath(filepath, app_dir)}")
                        count += 1
                except Exception as e:
                    print(f"  ❌ Error reading {file}: {e}")
    
    print(f"\n✨ Swapped endpoints in {count} files successfully.")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 switch_api.py <local-ip-or-simulator-url>")
        print("Example (Android Emulator): python3 switch_api.py http://10.0.2.2:8000")
        print("Example (iOS Simulator): python3 switch_api.py http://127.0.0.1:8000")
    else:
        replace_in_files(sys.argv[1])
