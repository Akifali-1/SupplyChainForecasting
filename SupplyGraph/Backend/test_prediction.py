import requests
import json

# Test the prediction API
url = "http://localhost:5000/api/ml/predict/690385f7bebb497ca14a6359"
headers = {"Content-Type": "application/json"}

# Test data - using a product that should be in the trained model
data = {
    "input_data": [
        {
            "node_type": "store",
            "company": "690385f7bebb497ca14a6359",
            "product": "IPHONE14PRO"
        }
    ]
}

try:
    response = requests.post(url, headers=headers, json=data)
    print("Status Code:", response.status_code)
    print("Response:", json.dumps(response.json(), indent=2))
except Exception as e:
    print("Error:", str(e))