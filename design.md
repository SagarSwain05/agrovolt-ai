# System Design Document - AgroVolt AI

## 1. High-Level Architecture

The system follows a **Hybrid Cloud-Edge Architecture** to ensure robust performance in rural areas with intermittent connectivity.

### Architectural Layers

1. **Data Collection Layer:** Satellite APIs (NASA), IoT Sensors, and User Smartphones.
2. **Intelligence Layer (Cloud + Edge):** Deep Learning models for prediction and optimization.
3. **Application Layer:** Unified mobile interface for stakeholders.
4. **Execution Layer:** Real-world farm actions (Irrigation, Tilt, Sales).

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│              Flutter Mobile App (Android/iOS)                │
│         [Farmer UI | Solar EPC UI | Admin Dashboard]        │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│   │   Node.js    │  │   Python     │  │   Firebase   │    │
│   │ API Gateway  │  │   FastAPI    │  │     Auth     │    │
│   └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                   INTELLIGENCE LAYER                         │
│  ┌────────────────────┐        ┌────────────────────┐      │
│  │   Cloud AI Engine  │        │   Edge AI Engine   │      │
│  │  (PINNs - Python)  │        │ (TensorFlow Lite)  │      │
│  └────────────────────┘        └────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   MongoDB    │  │   InfluxDB   │  │  External    │     │
│  │ (User Data)  │  │ (Time-Series)│  │     APIs     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## 2. Technology Stack

### 2.1 Frontend
* **Framework:** Flutter (Dart)
* **Rationale:** Cross-platform development, offline-first capabilities, native performance
* **Key Libraries:**
  - `flutter_offline`: Offline state management
  - `ar_flutter_plugin`: AR Solar Tilt Tool
  - `speech_to_text`: Voice input for Sahayak
  - `sqflite`: Local database for offline mode

### 2.2 Backend
* **API Gateway:** Node.js (Express.js)
  - Handles routing, authentication, rate limiting
  - WebSocket support for real-time updates
* **AI Microservices:** Python FastAPI
  - High-performance async framework
  - Native integration with ML libraries

### 2.3 Database Architecture
* **MongoDB (Document Store)**
  - User profiles and authentication
  - Farm configurations
  - Crop logs and advisory history
  - Carbon credit transactions
* **InfluxDB (Time-Series Database)**
  - IoT sensor data (temperature, humidity, soil moisture)
  - Solar panel metrics (voltage, current, power output)
  - Historical weather data
  - Performance analytics

### 2.4 AI/ML Stack
* **Cloud AI Engine:**
  - **Framework:** TensorFlow/PyTorch
  - **PINNs (Physics-Informed Neural Networks):** Microclimate simulation
  - **Deep Learning Models:** Crop yield prediction, price forecasting
* **Edge AI Engine:**
  - **Framework:** TensorFlow Lite
  - **Models:** Disease detection, soiling detection, AR alignment
  - **Optimization:** Quantization for 2GB RAM devices

### 2.5 External Data Sources
* **NASA POWER API:** Solar irradiance, temperature, precipitation
* **Agmarknet API:** Real-time Mandi prices, commodity trends
* **IMD (India Meteorological Department):** Weather forecasts
* **IoT Sensors:** Soil moisture, ambient temperature, panel temperature

## 3. Module Design

### 3.1 Data Ingestion Module

**Purpose:** Collect, validate, and normalize data from multiple sources.

**Components:**
* **API Connectors:** Scheduled jobs to fetch external data
* **IoT Gateway:** MQTT broker for sensor data ingestion
* **Data Validators:** Schema validation and anomaly detection
* **ETL Pipeline:** Transform raw data into standardized formats

**Data Flow:**
```
External APIs → API Connectors → Validation → MongoDB/InfluxDB
IoT Sensors → MQTT Broker → Data Processor → InfluxDB
User Input → Mobile App → API Gateway → MongoDB
```

### 3.2 Bio-Solar Intelligence Engine

**Purpose:** Optimize the symbiotic relationship between crops and solar panels.

**Input Parameters:**
* Soil moisture levels
* Crop growth stage
* Panel temperature
* Solar irradiance angle
* Ambient temperature
* Humidity

**Processing Logic:**
1. **Transpiration Model:** Calculate crop water vapor emission rates
2. **Cooling Effect:** Predict temperature reduction on solar panels
3. **Efficiency Gain:** Compute photovoltaic efficiency improvement
4. **Optimization:** Recommend irrigation timing and panel tilt angles

**Output:**
* Optimal irrigation schedule
* Recommended panel tilt angles
* Expected efficiency gains
* Water savings projections

**Algorithm:**
```python
# Simplified PINN-based microclimate model
def optimize_bio_solar(crop_stage, soil_moisture, panel_temp, solar_angle):
    transpiration_rate = calculate_transpiration(crop_stage, soil_moisture)
    cooling_effect = predict_cooling(transpiration_rate, panel_temp)
    efficiency_gain = compute_pv_efficiency(cooling_effect)
    
    optimal_irrigation = schedule_irrigation(transpiration_rate, soil_moisture)
    optimal_tilt = calculate_tilt(solar_angle, efficiency_gain)
    
    return {
        'irrigation_time': optimal_irrigation,
        'tilt_angle': optimal_tilt,
        'expected_gain': efficiency_gain
    }
```

### 3.3 Advisory Layer

**Purpose:** Generate actionable recommendations for farmers.

**Sub-Modules:**
* **Crop Advisory:** Disease detection, treatment recommendations
* **Solar Advisory:** Cleaning alerts, tilt optimization
* **Market Advisory:** Price trends, optimal selling time
* **Financial Advisory:** Revenue projections, carbon credit calculations

**Decision Engine:**
```
Input: Current farm state + Historical data + Weather forecast
↓
Rule-Based System + ML Predictions
↓
Priority Ranking (Urgency × Impact)
↓
Output: Prioritized action list for farmer
```

### 3.4 Sahayak Voice Engine

**Purpose:** Provide vernacular voice interface for illiterate farmers.

**Architecture:**
* **Speech-to-Text (STT):** Google Cloud Speech API (online) / Vosk (offline)
* **Natural Language Understanding:** Fine-tuned Llama-3 (4-bit quantized)
* **Intent Recognition:** Custom classifier for farming domain
* **Text-to-Speech (TTS):** Google Cloud TTS (online) / eSpeak (offline)

**Supported Languages:** Hindi, Odia (Phase 1)

**Conversation Flow:**
```
Farmer speaks → STT → Intent Recognition → Query Processing → Response Generation → TTS → Audio output
```

### 3.5 Field Execution Module

**Purpose:** Bridge digital recommendations to physical farm actions.

**Features:**
* **AR Solar Tilt Tool:** Camera-based guidance for manual panel adjustment
* **Irrigation Scheduler:** Push notifications for watering times
* **Task Tracker:** Checklist for daily farm activities
* **Feedback Loop:** Capture action completion and outcomes

## 4. Data Flow Architecture

### 4.1 Typical User Journey: Disease Detection

```
1. Farmer opens app → Selects "Crop Health" → Taps camera icon
2. Captures leaf image → Image stored locally (offline mode)
3. Edge AI (TensorFlow Lite) runs CNN model on device
4. Disease detected: "Early Blight" (Confidence: 87%)
5. App displays treatment recommendation (offline database)
6. When online: Image + diagnosis synced to cloud
7. Cloud AI validates diagnosis, updates farm health score
8. System checks weather: Rain forecast in 2 days
9. Advisory: "Wait for rain to pass before spraying fungicide"
10. Farmer confirms action → Task marked complete
11. Follow-up reminder scheduled for 7 days
```

### 4.2 Real-Time Data Synchronization

**Offline-First Strategy:**
* All critical features work without internet
* Local SQLite database stores 30 days of data
* Background sync when connectivity available
* Conflict resolution: Last-write-wins with timestamp

**Sync Priority:**
1. Critical alerts (disease outbreak, equipment failure)
2. User actions (task completion, image uploads)
3. Sensor data (batched every 15 minutes)
4. Analytics data (daily aggregation)

## 5. Security & Privacy

### 5.1 Authentication & Authorization
* **Method:** Phone number-based OTP via Firebase Authentication
* **Session Management:** JWT tokens with 7-day expiry
* **Role-Based Access Control (RBAC):**
  - Farmer: Full access to own farm data
  - Solar EPC: Read-only access to panel metrics
  - Government Admin: Aggregated district-level data only

### 5.2 Data Encryption
* **In Transit:** TLS 1.3 for all API communications
* **At Rest:** AES-256 encryption for sensitive data (financial, personal)
* **Mobile Storage:** Android Keystore / iOS Keychain for credentials

### 5.3 Privacy Compliance
* **Data Minimization:** Collect only essential information
* **Anonymization:** GPS coordinates rounded to 100m for privacy
* **User Consent:** Explicit opt-in for data sharing with government
* **Right to Deletion:** Users can request complete data removal

### 5.4 Carbon Ledger Security
* **Immutable Log:** Append-only database for carbon credit transactions
* **Verification:** Cryptographic signatures for each entry
* **Audit Trail:** Complete history of credit generation and redemption
* **Transparency:** Public dashboard for aggregated carbon offsets

## 6. Deployment Strategy

### 6.1 Infrastructure
* **Cloud Provider:** AWS (primary), Google Cloud (backup)
* **Regions:** Mumbai (ap-south-1) for low latency
* **CDN:** CloudFront for static assets and app updates

### 6.2 Containerization
* **Docker:** All microservices containerized
* **Base Images:** Alpine Linux for minimal footprint
* **Registry:** AWS ECR for private image storage

### 6.3 Orchestration
* **Kubernetes (EKS):** Auto-scaling for AI workloads
* **Horizontal Pod Autoscaler:** Scale based on CPU/memory
* **Load Balancer:** Application Load Balancer for traffic distribution

### 6.4 CI/CD Pipeline
```
GitHub → GitHub Actions → Build & Test → Docker Build → Push to ECR → Deploy to EKS
```

**Stages:**
1. **Code Commit:** Developer pushes to GitHub
2. **Automated Tests:** Unit tests, integration tests, linting
3. **Build:** Docker images created for each microservice
4. **Security Scan:** Trivy scans for vulnerabilities
5. **Deploy to Staging:** Automatic deployment for testing
6. **Manual Approval:** Product owner approves production release
7. **Deploy to Production:** Blue-green deployment for zero downtime
8. **Monitoring:** CloudWatch alerts for errors and performance

### 6.5 Monitoring & Observability
* **Application Monitoring:** New Relic / Datadog
* **Log Aggregation:** ELK Stack (Elasticsearch, Logstash, Kibana)
* **Error Tracking:** Sentry for crash reporting
* **Performance Metrics:** Prometheus + Grafana dashboards

**Key Metrics:**
* API response time (p95 < 500ms)
* Mobile app crash rate (< 0.1%)
* AI inference latency (< 2 seconds)
* Database query performance
* User engagement (DAU/MAU ratio)

## 7. Scalability Considerations

### 7.1 Horizontal Scaling
* **Stateless Services:** All microservices designed to scale horizontally
* **Database Sharding:** MongoDB sharded by user region
* **Caching Layer:** Redis for frequently accessed data

### 7.2 Performance Optimization
* **API Rate Limiting:** 100 requests/minute per user
* **Image Compression:** WebP format for 30% size reduction
* **Lazy Loading:** Load data on-demand in mobile app
* **Database Indexing:** Optimized queries for common operations

### 7.3 Capacity Planning
* **Target:** Support 100,000 concurrent users
* **Storage:** 10TB for first year (user data + images)
* **Compute:** Auto-scale from 10 to 100 pods based on load
* **Bandwidth:** 1 Gbps for peak traffic

## 8. Disaster Recovery

### 8.1 Backup Strategy
* **Database Backups:** Daily full backup, hourly incremental
* **Retention:** 30 days for operational data, 7 years for financial records
* **Geographic Redundancy:** Backups stored in multiple AWS regions

### 8.2 Recovery Objectives
* **RTO (Recovery Time Objective):** 4 hours
* **RPO (Recovery Point Objective):** 1 hour
* **Failover:** Automatic failover to backup region

## 9. Future Enhancements

### Phase 2 (6-12 months)
* **IoT Integration:** Direct sensor connectivity via LoRaWAN
* **Blockchain:** Decentralized carbon credit marketplace
* **Satellite Imagery:** NDVI-based crop health monitoring

### Phase 3 (12-24 months)
* **Predictive Maintenance:** AI-driven equipment failure prediction
* **Community Features:** Farmer-to-farmer knowledge sharing
* **Drone Integration:** Automated aerial crop surveillance

## 10. Appendix

### 10.1 API Endpoints (Sample)

```
POST   /api/v1/auth/login              - User authentication
GET    /api/v1/farms/{farmId}          - Get farm details
POST   /api/v1/crops/diagnose          - Upload crop image for diagnosis
GET    /api/v1/solar/metrics           - Get solar panel performance
POST   /api/v1/advisory/irrigation     - Get irrigation recommendations
GET    /api/v1/market/prices           - Get current Mandi prices
GET    /api/v1/carbon/balance          - Get carbon credit balance
```

### 10.2 Database Schema (Simplified)

**MongoDB Collections:**
```javascript
// users
{
  _id: ObjectId,
  phone: String,
  name: String,
  role: Enum['farmer', 'epc', 'admin'],
  language: String,
  createdAt: Date
}

// farms
{
  _id: ObjectId,
  userId: ObjectId,
  location: { lat: Number, lng: Number },
  area: Number,
  crops: [{ type: String, plantedDate: Date }],
  solarPanels: { count: Number, capacity: Number }
}
```

**InfluxDB Measurements:**
```
sensor_data:
  - time
  - farmId
  - sensorType
  - value
  - unit
```
