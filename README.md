# PMS - Predictive Maintenance System

A comprehensive Preventive Maintenance Software (PMS) backend to manage maintenance operations, assets, inventory, vendors, reporting, and predictive maintenance workflows.

## Features

### 1. Work Order Management
- Create, update, and track work orders
- Assign work orders to technicians
- Track completion status and timelines
- Priority-based scheduling
- Attachment references for documentation

### 2. Asset Management
- Register and track physical assets
- Track asset location and status
- Store maintenance history references
- Capture lifecycle and depreciation-relevant fields

### 3. Inventory Management
- Track spare parts and materials
- Monitor stock levels and reorder points
- Track inventory usage in work orders
- Track preferred vendor and unit costs

### 4. Vendor Management
- Maintain vendor records and contact details
- Record vendor ratings and agreements
- Store vendor performance notes

### 5. Maintenance Reports
- Create and manage period-based reports
- Track labor hours, downtime, and costs
- Maintain compliance notes for documentation

### 6. Predictive Maintenance
- API endpoint for risk scoring and anomaly detection
- Trend-based failure probability heuristics
- Actionable maintenance recommendation output
- Python ML training starter using scikit-learn

## Tech Stack

- Backend: Node.js + Express.js
- Database: MongoDB + Mongoose
- API: RESTful JSON APIs
- ML/Analytics: Python + scikit-learn starter pipeline

## Project Structure

```
.
├── ml/
│   ├── requirements.txt
│   └── train_failure_model.py
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── app.js
│   └── server.js
├── .env.example
├── package.json
└── README.md
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Set values in `.env`:

```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/pms
NODE_ENV=development
```

### 3. Start server

```bash
npm run dev
```

Server base URL: `http://localhost:4000`

## API Overview

Base prefix: `/api`

- `GET /api/health`
- `GET|POST /api/assets`
- `GET|PUT|DELETE /api/assets/:id`
- `GET|POST /api/work-orders`
- `GET|PUT|DELETE /api/work-orders/:id`
- `GET|POST /api/inventory`
- `GET|PUT|DELETE /api/inventory/:id`
- `GET|POST /api/vendors`
- `GET|PUT|DELETE /api/vendors/:id`
- `GET|POST /api/reports`
- `GET|PUT|DELETE /api/reports/:id`
- `POST /api/predictive/analyze`

Query support on list endpoints:
- `page` (default: `1`)
- `limit` (default: `20`, max `100`)
- `search` (full-text where index is available)

## Predictive Analysis Example

### Request

```http
POST /api/predictive/analyze
Content-Type: application/json

{
	"readings": [58.2, 60.1, 62.9, 63.4, 70.8],
	"recentFailures": 1,
	"ageYears": 7
}
```

### Response

```json
{
	"success": true,
	"data": {
		"riskLevel": "medium",
		"failureProbability": 0.41,
		"anomalyCount": 1,
		"trendSlope": 12.6,
		"recommendation": "Increase monitoring frequency and verify operating conditions."
	}
}
```

## Python ML Starter

Install Python dependencies:

```bash
python3 -m pip install -r ml/requirements.txt
```

Add historical telemetry CSV at:

`ml/data/historical_telemetry.csv`

Then train:

```bash
python3 ml/train_failure_model.py
```

This will save a trained model to:

`ml/models/failure_model.joblib`

## Notes

- Current predictive endpoint uses a lightweight heuristic suitable as a baseline.
- The Python training pipeline is included to help move toward a production ML predictor.
- A React frontend can be added later to consume these APIs.