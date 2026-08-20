import os

paths = [
    r"c:\Users\Lenovo\Desktop\Rota de Ataque\Sistema de Design\plataforma\apps\web\src",
    r"c:\Users\Lenovo\Desktop\Rota de Ataque\Sistema de Design\plataforma\packages\ui-bridge\src"
]

replacements = {
    "--bg-canvas": "--surface-canvas",
    "--bg-surface": "--surface-card",
    "--bg-subtle": "--surface-subtle"
}

for base_path in paths:
    for root, dirs, files in os.walk(base_path):
        for file in files:
            if file.endswith(".ts") or file.endswith(".tsx") or file.endswith(".css"):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                    
                    new_content = content
                    for old, new in replacements.items():
                        new_content = new_content.replace(old, new)
                        
                    if content != new_content:
                        with open(filepath, "w", encoding="utf-8") as f:
                            f.write(new_content)
                        print(f"Updated {filepath}")
                except Exception as e:
                    print(f"Error reading {filepath}: {e}")
