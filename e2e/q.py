import sqlite3, sys, json
import os
con = sqlite3.connect(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "prisma", "dev.db")); con.row_factory = sqlite3.Row
print(json.dumps([dict(r) for r in con.execute(sys.argv[1])], ensure_ascii=False))
