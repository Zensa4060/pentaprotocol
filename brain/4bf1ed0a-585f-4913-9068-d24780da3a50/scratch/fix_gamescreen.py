import os

file_path = r'c:\Users\yagya\Documents\pentaprotocol\frontend\components\GameScreen.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Try to replace the RankIcon usage and the duplicate getRank import
new_content = content.replace('<RankIcon rank={rank} size={sideBySideSize} />', '<NavRankBadge rank={rank} size={sideBySideSize} isPlacement={false} />')
new_content = new_content.replace('import { getRank } from "./NavBar";', '') # This might remove both if not careful, but let's see.

# Wait, search for the specific lines first
if '<RankIcon rank={rank} size={sideBySideSize} />' in content:
    print("Found RankIcon usage")
else:
    print("RankIcon usage NOT found")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Finished script")
