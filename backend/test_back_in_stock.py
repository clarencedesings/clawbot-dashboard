#!/usr/bin/env python3
import os, json, urllib.request, traceback
from html import escape as html_escape
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv('/home/clarence/earthlie/backend/.env')

uri = os.getenv('MONGO_URI')
brevo_key = os.getenv('BREVO_API_KEY', '')
print(f'BREVO_API_KEY present: {bool(brevo_key)} (len={len(brevo_key)})')

client = MongoClient(uri)
db = client['earthlie_store']

product_id = '69beec66f16b38a6e205f14d'
product_name = 'LED Lamp with Remote'

subs = list(db['stock_notifications'].find({'product_id': product_id}))
print(f'Found {len(subs)} subscriber(s): {[s["email"] for s in subs]}')

if not subs:
    print('No subscribers - nothing to send')
    exit()

product_url = f'https://earthliedesigns.com/product/{product_id}'
html_body = (
    "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto'>"
    "<div style='background:#1a2332;padding:20px;text-align:center'>"
    "<h1 style='color:#e87722;margin:0'>Back in Stock!</h1>"
    "</div>"
    "<div style='padding:20px'>"
    f"<p style='color:#333;font-size:16px'>Great news! <strong>{html_escape(product_name)}</strong> is back in stock.</p>"
    f"<p style='margin-top:20px'><a href='{product_url}' style='display:inline-block;background:#e87722;color:#fff;"
    "padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold'>Shop Now</a></p>"
    "<p style='color:#999;font-size:12px;margin-top:20px'>You received this email because you signed up to be "
    "notified when this product was back in stock.</p>"
    "</div>"
    "</div>"
)

for sub in subs:
    try:
        payload = json.dumps({
            'sender': {'name': 'Earthlie Designs', 'email': 'orders@earthliedesigns.com'},
            'to': [{'email': sub['email']}],
            'subject': f'Good news! {product_name} is back in stock',
            'htmlContent': html_body,
        }).encode('utf-8')
        print(f'Sending to {sub["email"]}...')
        req = urllib.request.Request(
            'https://api.brevo.com/v3/smtp/email',
            data=payload,
            headers={'accept': 'application/json', 'content-type': 'application/json', 'api-key': brevo_key},
            method='POST',
        )
        resp = urllib.request.urlopen(req, timeout=10)
        print(f'Brevo response: {resp.status} {resp.read().decode()}')
    except Exception as e:
        print(f'FAILED: {e}')
        traceback.print_exc()

# Clean up
result = db['stock_notifications'].delete_many({'product_id': product_id})
print(f'Cleaned up {result.deleted_count} notification(s)')
client.close()
