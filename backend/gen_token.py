import os
from dotenv import load_dotenv
load_dotenv('/home/clarence/earthlie/backend/.env')
from jose import jwt
from datetime import datetime, timedelta
token = jwt.encode({'sub': '69c0234d183b69808eb584f2', 'email': 'admin@earthliedesigns.com', 'role': 'admin', 'exp': datetime.utcnow() + timedelta(hours=1)}, os.getenv('JWT_SECRET'), algorithm='HS256')
print(token)
