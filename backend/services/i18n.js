'use strict';
// Server-side message catalogue (English / हिन्दी / ଓଡ଼ିଆ) for advisories and
// the rule-based assistant. Placeholders: {name}.

const M = {
    // ── Advisory actions ────────────────────────────────────────────────
    adv_irrigate_cool: {
        en: 'Irrigate between 6–8 AM today. Soil moisture is {sm}% and it will reach {t}°C — crop transpiration can cool your panels by about {d}°C.',
        hi: 'आज सुबह 6–8 बजे के बीच सिंचाई करें। मिट्टी की नमी {sm}% है और तापमान {t}°C तक जाएगा — फसल का वाष्पोत्सर्जन पैनलों को लगभग {d}°C ठंडा कर सकता है।',
        or: 'ଆଜି ସକାଳ 6–8 ମଧ୍ୟରେ ଜଳସେଚନ କରନ୍ତୁ। ମାଟି ଆର୍ଦ୍ରତା {sm}% ଏବଂ ତାପମାତ୍ରା {t}°C ପର୍ଯ୍ୟନ୍ତ ଯିବ — ଫସଲର ବାଷ୍ପୋତ୍ସର୍ଜନ ପ୍ୟାନେଲକୁ ପ୍ରାୟ {d}°C ଥଣ୍ଡା କରିପାରେ।',
    },
    adv_irrigate_dry: {
        en: 'Soil moisture is low ({sm}%). Irrigate this evening to reduce evaporation loss.',
        hi: 'मिट्टी की नमी कम है ({sm}%)। वाष्पीकरण से होने वाले नुकसान को कम करने के लिए आज शाम सिंचाई करें।',
        or: 'ମାଟି ଆର୍ଦ୍ରତା କମ୍ ଅଛି ({sm}%)। ବାଷ୍ପୀଭବନ କ୍ଷତି କମାଇବାକୁ ଆଜି ସନ୍ଧ୍ୟାରେ ଜଳସେଚନ କରନ୍ତୁ।',
    },
    adv_skip_irrigation: {
        en: '{mm} mm rain expected {when}. Skip irrigation and check field drainage.',
        hi: '{when} {mm} मिमी बारिश की संभावना है। सिंचाई न करें और खेत की जल निकासी जांचें।',
        or: '{when} {mm} ମିମି ବର୍ଷା ହେବାର ସମ୍ଭାବନା। ଜଳସେଚନ କରନ୍ତୁ ନାହିଁ ଏବଂ କ୍ଷେତର ଜଳ ନିଷ୍କାସନ ଯାଞ୍ଚ କରନ୍ତୁ।',
    },
    adv_tilt: {
        en: 'Adjust panel tilt from {cur}° to {opt}° for about +{gain}% more energy this season.',
        hi: 'इस मौसम में लगभग +{gain}% अधिक बिजली के लिए पैनल का झुकाव {cur}° से {opt}° करें।',
        or: 'ଏହି ଋତୁରେ ପ୍ରାୟ +{gain}% ଅଧିକ ବିଦ୍ୟୁତ ପାଇଁ ପ୍ୟାନେଲର କୋଣ {cur}° ରୁ {opt}° କରନ୍ତୁ।',
    },
    adv_clean: {
        en: 'No rain for {n} days — dust is building on the panels. Rinse them early morning to recover 3–5% output.',
        hi: '{n} दिनों से बारिश नहीं हुई — पैनलों पर धूल जम रही है। 3–5% उत्पादन वापस पाने के लिए सुबह जल्दी पानी से धोएं।',
        or: '{n} ଦିନ ହେଲା ବର୍ଷା ନାହିଁ — ପ୍ୟାନେଲରେ ଧୂଳି ଜମୁଛି। 3–5% ଉତ୍ପାଦନ ଫେରି ପାଇବାକୁ ସକାଳୁ ପାଣିରେ ଧୁଅନ୍ତୁ।',
    },
    adv_low_sun: {
        en: 'Cloudy {when} (only {rad} kWh/m² sunlight). Expect lower solar output — a good day to clean panels.',
        hi: '{when} बादल रहेंगे (केवल {rad} kWh/m² धूप)। सौर उत्पादन कम रहेगा — पैनल साफ करने के लिए अच्छा दिन है।',
        or: '{when} ମେଘୁଆ ରହିବ (କେବଳ {rad} kWh/m² ଖରା)। ସୌର ଉତ୍ପାଦନ କମ୍ ହେବ — ପ୍ୟାନେଲ ସଫା କରିବା ପାଇଁ ଭଲ ଦିନ।',
    },
    adv_heat: {
        en: 'Heatwave: {t}°C {when}. Irrigate early, keep the understory crop shaded, and avoid spraying at midday.',
        hi: 'लू की चेतावनी: {when} {t}°C। जल्दी सिंचाई करें, फसल को छाया में रखें और दोपहर में छिड़काव न करें।',
        or: 'ତାପଲହରୀ: {when} {t}°C। ଶୀଘ୍ର ଜଳସେଚନ କରନ୍ତୁ, ଫସଲକୁ ଛାଇରେ ରଖନ୍ତୁ ଏବଂ ମଧ୍ୟାହ୍ନରେ ସ୍ପ୍ରେ କରନ୍ତୁ ନାହିଁ।',
    },
    adv_disease: {
        en: 'Follow up on {disease} in {crop} (scanned {date}). Apply the recommended treatment and rescan in 5 days.',
        hi: '{crop} में {disease} पर ध्यान दें ({date} को स्कैन किया)। सुझाया गया उपचार करें और 5 दिन बाद फिर स्कैन करें।',
        or: '{crop} ରେ {disease} ଉପରେ ଧ୍ୟାନ ଦିଅନ୍ତୁ ({date} ରେ ସ୍କାନ୍)। ସୁପାରିଶ କରାଯାଇଥିବା ଚିକିତ୍ସା କରନ୍ତୁ ଏବଂ 5 ଦିନ ପରେ ପୁଣି ସ୍କାନ୍ କରନ୍ତୁ।',
    },
    adv_sell: {
        en: '{crop}: ₹{price}/quintal at {mandi}. Prices are forecast to fall {pct}% — sell now.',
        hi: '{crop}: {mandi} में ₹{price}/क्विंटल। कीमतें {pct}% गिरने का अनुमान है — अभी बेचें।',
        or: '{crop}: {mandi} ରେ ₹{price}/କ୍ୱିଣ୍ଟାଲ। ଦର {pct}% କମିବାର ଆଶଙ୍କା — ବର୍ତ୍ତମାନ ବିକ୍ରି କରନ୍ତୁ।',
    },
    adv_wait: {
        en: '{crop}: ₹{price}/quintal at {mandi}. Prices are forecast to rise {pct}% in {days} days — wait before selling.',
        hi: '{crop}: {mandi} में ₹{price}/क्विंटल। {days} दिनों में कीमतें {pct}% बढ़ने का अनुमान है — बेचने से पहले रुकें।',
        or: '{crop}: {mandi} ରେ ₹{price}/କ୍ୱିଣ୍ଟାଲ। {days} ଦିନରେ ଦର {pct}% ବଢ଼ିବାର ଆଶା — ବିକ୍ରି ପୂର୍ବରୁ ଅପେକ୍ଷା କରନ୍ତୁ।',
    },
    adv_hold: {
        en: '{crop}: ₹{price}/quintal at {mandi}. Prices are stable — sell as per your need.',
        hi: '{crop}: {mandi} में ₹{price}/क्विंटल। कीमतें स्थिर हैं — अपनी ज़रूरत के अनुसार बेचें।',
        or: '{crop}: {mandi} ରେ ₹{price}/କ୍ୱିଣ୍ଟାଲ। ଦର ସ୍ଥିର ଅଛି — ଆବଶ୍ୟକତା ଅନୁସାରେ ବିକ୍ରି କରନ୍ତୁ।',
    },
    adv_setup_solar: {
        en: 'Add your solar panel details in Settings to start tracking energy income and carbon credits.',
        hi: 'बिजली की आय और कार्बन क्रेडिट ट्रैक करने के लिए सेटिंग्स में अपने सोलर पैनल का विवरण जोड़ें।',
        or: 'ବିଦ୍ୟୁତ ଆୟ ଓ କାର୍ବନ କ୍ରେଡିଟ ଟ୍ରାକ୍ କରିବାକୁ ସେଟିଂସରେ ଆପଣଙ୍କ ସୋଲାର ପ୍ୟାନେଲ ବିବରଣୀ ଯୋଡ଼ନ୍ତୁ।',
    },
    adv_all_good: {
        en: 'All systems normal. No urgent action needed right now.',
        hi: 'सब कुछ सामान्य है। अभी किसी तत्काल कार्रवाई की ज़रूरत नहीं है।',
        or: 'ସବୁକିଛି ସ୍ୱାଭାବିକ ଅଛି। ବର୍ତ୍ତମାନ କୌଣସି ଜରୁରୀ କାର୍ଯ୍ୟ ଆବଶ୍ୟକ ନାହିଁ।',
    },

    // ── Time words ──────────────────────────────────────────────────────
    today: { en: 'today', hi: 'आज', or: 'ଆଜି' },
    tomorrow: { en: 'tomorrow', hi: 'कल', or: 'କାଲି' },
    in_days: { en: 'in {n} days', hi: '{n} दिन में', or: '{n} ଦିନରେ' },

    // ── Rule-based assistant replies ────────────────────────────────────
    a_weather: {
        en: 'Right now in {place} it is {temp}°C with {desc}, humidity {hum}%. Today: {min}–{max}°C, {rainChance}% chance of rain, {rad} kWh/m² sunlight.',
        hi: 'अभी {place} में तापमान {temp}°C है, {desc}, नमी {hum}%। आज: {min}–{max}°C, बारिश की संभावना {rainChance}%, धूप {rad} kWh/m²।',
        or: 'ବର୍ତ୍ତମାନ {place} ରେ ତାପମାତ୍ରା {temp}°C, {desc}, ଆର୍ଦ୍ରତା {hum}%। ଆଜି: {min}–{max}°C, ବର୍ଷା ସମ୍ଭାବନା {rainChance}%, ଖରା {rad} kWh/m²।',
    },
    a_forecast: {
        en: 'Next days: {list}.',
        hi: 'आने वाले दिन: {list}।',
        or: 'ଆଗାମୀ ଦିନ: {list}।',
    },
    a_solar: {
        en: 'Your {cap} kW array is producing {power} W now; {today} kWh so far today. Panel temperature {pt}°C — crops are cooling it by {cool}°C. Current tilt {tilt}°, best for this season {opt}°.',
        hi: 'आपका {cap} kW सोलर सिस्टम अभी {power} W बना रहा है; आज अब तक {today} kWh। पैनल का तापमान {pt}°C — फसलें इसे {cool}°C ठंडा कर रही हैं। अभी झुकाव {tilt}°, इस मौसम के लिए सबसे अच्छा {opt}°।',
        or: 'ଆପଣଙ୍କ {cap} kW ସୋଲାର ବର୍ତ୍ତମାନ {power} W ଉତ୍ପାଦନ କରୁଛି; ଆଜି ଏପର୍ଯ୍ୟନ୍ତ {today} kWh। ପ୍ୟାନେଲ ତାପମାତ୍ରା {pt}°C — ଫସଲ ଏହାକୁ {cool}°C ଥଣ୍ଡା କରୁଛି। ବର୍ତ୍ତମାନ କୋଣ {tilt}°, ଏହି ଋତୁ ପାଇଁ ସର୍ବୋତ୍ତମ {opt}°।',
    },
    a_solar_none: {
        en: 'No solar panels are set up on your farm yet. Add capacity and tilt in Settings and I will track generation, income and carbon credits.',
        hi: 'आपके खेत में अभी सोलर पैनल सेट नहीं हैं। सेटिंग्स में क्षमता और झुकाव जोड़ें, फिर मैं बिजली, आय और कार्बन क्रेडिट ट्रैक करूंगा।',
        or: 'ଆପଣଙ୍କ କ୍ଷେତରେ ଏପର୍ଯ୍ୟନ୍ତ ସୋଲାର ପ୍ୟାନେଲ ସେଟ୍ ହୋଇନାହିଁ। ସେଟିଂସରେ କ୍ଷମତା ଓ କୋଣ ଯୋଡ଼ନ୍ତୁ, ତାପରେ ମୁଁ ବିଦ୍ୟୁତ, ଆୟ ଓ କାର୍ବନ କ୍ରେଡିଟ ଟ୍ରାକ୍ କରିବି।',
    },
    a_market: {
        en: '{crop} is ₹{price}/quintal at {mandi} (best after transport). {advice}',
        hi: '{crop} का भाव {mandi} में ₹{price}/क्विंटल है (परिवहन के बाद सबसे अच्छा)। {advice}',
        or: '{crop} ର ଦର {mandi} ରେ ₹{price}/କ୍ୱିଣ୍ଟାଲ (ପରିବହନ ପରେ ସର୍ବୋତ୍ତମ)। {advice}',
    },
    a_market_sell: { en: 'Forecast shows a fall — sell soon.', hi: 'अनुमान है कि भाव गिरेगा — जल्दी बेचें।', or: 'ଦର କମିବାର ଆଶଙ୍କା — ଶୀଘ୍ର ବିକ୍ରି କରନ୍ତୁ।' },
    a_market_wait: { en: 'Forecast shows +{pct}% in {days} days — waiting may pay more.', hi: '{days} दिनों में +{pct}% का अनुमान — रुकने से ज़्यादा मिल सकता है।', or: '{days} ଦିନରେ +{pct}% ଆଶା — ଅପେକ୍ଷା କଲେ ଅଧିକ ମିଳିପାରେ।' },
    a_market_hold: { en: 'Prices look stable this week.', hi: 'इस हफ्ते भाव स्थिर दिख रहे हैं।', or: 'ଏହି ସପ୍ତାହ ଦର ସ୍ଥିର ଦେଖାଯାଉଛି।' },
    a_carbon: {
        en: 'You have earned {credits} carbon credits ({co2} kg CO₂ avoided), worth about ₹{value}. Water saved by panel shade: {water} litres.',
        hi: 'आपने {credits} कार्बन क्रेडिट कमाए हैं ({co2} किलो CO₂ बचाई), जिनकी कीमत लगभग ₹{value} है। पैनल की छाया से {water} लीटर पानी बचा।',
        or: 'ଆପଣ {credits} କାର୍ବନ କ୍ରେଡିଟ ଅର୍ଜନ କରିଛନ୍ତି ({co2} କିଲୋ CO₂ ବଞ୍ଚାଇଛନ୍ତି), ମୂଲ୍ୟ ପ୍ରାୟ ₹{value}। ପ୍ୟାନେଲ ଛାଇରୁ {water} ଲିଟର ଜଳ ସଞ୍ଚୟ ହୋଇଛି।',
    },
    a_income: {
        en: 'Last 30 days: solar income ₹{solar} from {kwh} kWh, carbon value ₹{carbon}. Total ₹{total}.',
        hi: 'पिछले 30 दिन: {kwh} kWh से सौर आय ₹{solar}, कार्बन मूल्य ₹{carbon}। कुल ₹{total}।',
        or: 'ଗତ 30 ଦିନ: {kwh} kWh ରୁ ସୌର ଆୟ ₹{solar}, କାର୍ବନ ମୂଲ୍ୟ ₹{carbon}। ମୋଟ ₹{total}।',
    },
    a_soil: {
        en: 'Soil moisture under the panels is {sm}% and soil temperature {st}°C. {hint}',
        hi: 'पैनलों के नीचे मिट्टी की नमी {sm}% और मिट्टी का तापमान {st}°C है। {hint}',
        or: 'ପ୍ୟାନେଲ ତଳେ ମାଟି ଆର୍ଦ୍ରତା {sm}% ଏବଂ ମାଟି ତାପମାତ୍ରା {st}°C। {hint}',
    },
    a_soil_dry: { en: 'It is on the dry side — irrigate early morning.', hi: 'मिट्टी सूखी है — सुबह जल्दी सिंचाई करें।', or: 'ମାଟି ଶୁଖିଲା ଅଛି — ସକାଳୁ ଜଳସେଚନ କରନ୍ତୁ।' },
    a_soil_ok: { en: 'Moisture is adequate — no irrigation needed today.', hi: 'नमी पर्याप्त है — आज सिंचाई की ज़रूरत नहीं।', or: 'ଆର୍ଦ୍ରତା ଯଥେଷ୍ଟ — ଆଜି ଜଳସେଚନ ଆବଶ୍ୟକ ନାହିଁ।' },
    a_disease: {
        en: 'Your last scan found {disease} in {crop} ({conf}% confidence, {date}). Open Scan to see the treatment, or scan a new leaf.',
        hi: 'आपके पिछले स्कैन में {crop} में {disease} मिला ({conf}% विश्वास, {date})। उपचार देखने के लिए स्कैन खोलें या नई पत्ती स्कैन करें।',
        or: 'ଆପଣଙ୍କ ଶେଷ ସ୍କାନରେ {crop} ରେ {disease} ମିଳିଛି ({conf}% ନିଶ୍ଚିତତା, {date})। ଚିକିତ୍ସା ଦେଖିବାକୁ ସ୍କାନ୍ ଖୋଲନ୍ତୁ କିମ୍ବା ନୂଆ ପତ୍ର ସ୍କାନ୍ କରନ୍ତୁ।',
    },
    a_disease_none: {
        en: 'No disease scans yet. Open Scan and photograph a leaf — I will identify the disease and the organic treatment.',
        hi: 'अभी तक कोई रोग स्कैन नहीं हुआ। स्कैन खोलें और पत्ती की फोटो लें — मैं रोग और जैविक उपचार बताऊंगा।',
        or: 'ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ରୋଗ ସ୍କାନ୍ ହୋଇନାହିଁ। ସ୍କାନ୍ ଖୋଲି ପତ୍ରର ଫଟୋ ନିଅନ୍ତୁ — ମୁଁ ରୋଗ ଓ ଜୈବିକ ଚିକିତ୍ସା କହିବି।',
    },
    a_subsidy: {
        en: 'Under PM-KUSUM you can get 30% central + 30% state subsidy on a solar pump (Component B), or sell surplus power to DISCOM (Component C). Open Subsidies to check eligibility.',
        hi: 'पीएम-कुसुम के तहत सोलर पंप पर 30% केंद्र + 30% राज्य सब्सिडी (घटक B) मिलती है, या अतिरिक्त बिजली डिस्कॉम को बेच सकते हैं (घटक C)। पात्रता के लिए सब्सिडी पेज खोलें।',
        or: 'ପିଏମ୍-କୁସୁମ ଅଧୀନରେ ସୋଲାର ପମ୍ପ ଉପରେ 30% କେନ୍ଦ୍ର + 30% ରାଜ୍ୟ ସବସିଡି (ଉପାଦାନ B) ମିଳେ, କିମ୍ବା ଅତିରିକ୍ତ ବିଦ୍ୟୁତ ଡିସ୍କମକୁ ବିକ୍ରି କରିପାରିବେ (ଉପାଦାନ C)। ଯୋଗ୍ୟତା ପାଇଁ ସବସିଡି ପୃଷ୍ଠା ଖୋଲନ୍ତୁ।',
    },
    a_crop: {
        en: 'For {soil} soil with {shade}% panel shade, good choices are: {list}. Open Crops for full scores.',
        hi: '{soil} मिट्टी और {shade}% पैनल छाया के लिए अच्छे विकल्प हैं: {list}। पूरे स्कोर के लिए फसल पेज खोलें।',
        or: '{soil} ମାଟି ଓ {shade}% ପ୍ୟାନେଲ ଛାଇ ପାଇଁ ଭଲ ବିକଳ୍ପ: {list}। ସମ୍ପୂର୍ଣ୍ଣ ସ୍କୋର ପାଇଁ ଫସଲ ପୃଷ୍ଠା ଖୋଲନ୍ତୁ।',
    },
    a_advice: {
        en: 'Top actions now: {list}',
        hi: 'अभी के मुख्य काम: {list}',
        or: 'ବର୍ତ୍ତମାନର ମୁଖ୍ୟ କାର୍ଯ୍ୟ: {list}',
    },
    a_greet: {
        en: 'Namaste {name}! I am Sahayak. Ask me about weather, irrigation, your solar panels, mandi prices, crop disease, carbon credits or subsidies.',
        hi: 'नमस्ते {name}! मैं सहायक हूँ। मौसम, सिंचाई, सोलर पैनल, मंडी भाव, फसल रोग, कार्बन क्रेडिट या सब्सिडी के बारे में पूछें।',
        or: 'ନମସ୍କାର {name}! ମୁଁ ସହାୟକ। ପାଣିପାଗ, ଜଳସେଚନ, ସୋଲାର ପ୍ୟାନେଲ, ମଣ୍ଡି ଦର, ଫସଲ ରୋଗ, କାର୍ବନ କ୍ରେଡିଟ କିମ୍ବା ସବସିଡି ବିଷୟରେ ପଚାରନ୍ତୁ।',
    },
    a_unknown: {
        en: 'I can answer about weather, irrigation, solar panels, mandi prices, crop disease, carbon credits and subsidies. Please ask about one of these.',
        hi: 'मैं मौसम, सिंचाई, सोलर पैनल, मंडी भाव, फसल रोग, कार्बन क्रेडिट और सब्सिडी के बारे में बता सकता हूँ। कृपया इनमें से किसी के बारे में पूछें।',
        or: 'ମୁଁ ପାଣିପାଗ, ଜଳସେଚନ, ସୋଲାର ପ୍ୟାନେଲ, ମଣ୍ଡି ଦର, ଫସଲ ରୋଗ, କାର୍ବନ କ୍ରେଡିଟ ଓ ସବସିଡି ବିଷୟରେ କହିପାରିବି। ଦୟାକରି ଏଥିମଧ୍ୟରୁ କୌଣସି ବିଷୟରେ ପଚାରନ୍ତୁ।',
    },
};

// Crop and weather words that appear inside messages
const WORDS = {
    Tomato: { hi: 'टमाटर', or: 'ଟମାଟୋ' }, Turmeric: { hi: 'हल्दी', or: 'ହଳଦୀ' }, Rice: { hi: 'धान', or: 'ଧାନ' },
    Wheat: { hi: 'गेहूँ', or: 'ଗହମ' }, Millet: { hi: 'बाजरा', or: 'ମାଣ୍ଡିଆ' }, Groundnut: { hi: 'मूंगफली', or: 'ଚିନାବାଦାମ' },
    Soybean: { hi: 'सोयाबीन', or: 'ସୋୟାବିନ' }, Ginger: { hi: 'अदरक', or: 'ଅଦା' }, Spinach: { hi: 'पालक', or: 'ପାଳଙ୍ଗ' },
    Lettuce: { hi: 'सलाद पत्ता', or: 'ଲେଟୁସ' }, Chili: { hi: 'मिर्च', or: 'ଲଙ୍କା' }, Potato: { hi: 'आलू', or: 'ଆଳୁ' },
    Onion: { hi: 'प्याज', or: 'ପିଆଜ' },
    'clear sky': { hi: 'आसमान साफ', or: 'ଆକାଶ ପରିଷ୍କାର' }, 'mainly clear': { hi: 'ज़्यादातर साफ', or: 'ଅଧିକାଂଶ ପରିଷ୍କାର' },
    'partly cloudy': { hi: 'आंशिक बादल', or: 'ଆଂଶିକ ମେଘୁଆ' }, overcast: { hi: 'घने बादल', or: 'ଘନ ମେଘ' },
    fog: { hi: 'कोहरा', or: 'କୁହୁଡ଼ି' }, 'light drizzle': { hi: 'हल्की फुहार', or: 'ହାଲୁକା ଝିପିଝିପି' },
    drizzle: { hi: 'फुहार', or: 'ଝିପିଝିପି' }, 'light rain': { hi: 'हल्की बारिश', or: 'ହାଲୁକା ବର୍ଷା' },
    rain: { hi: 'बारिश', or: 'ବର୍ଷା' }, 'heavy rain': { hi: 'भारी बारिश', or: 'ପ୍ରବଳ ବର୍ଷା' },
    'rain showers': { hi: 'बौछारें', or: 'ବର୍ଷା' }, thunderstorm: { hi: 'आंधी-तूफान', or: 'ବଜ୍ରପାତ ସହ ବର୍ଷା' },
    loamy: { hi: 'दोमट', or: 'ଦୋରସା' }, clay: { hi: 'चिकनी', or: 'ମଟାଳ' }, sandy: { hi: 'बलुई', or: 'ବାଲିଆ' },
    alluvial: { hi: 'जलोढ़', or: 'ପଟୁ' }, red: { hi: 'लाल', or: 'ଲାଲ' }, black: { hi: 'काली', or: 'କଳା' },
    laterite: { hi: 'लेटराइट', or: 'ଲାଟେରାଇଟ' }, silt: { hi: 'गाद', or: 'ପଟୁ' },
};

const LANGS = ['en', 'hi', 'or'];
const normLang = (l) => (LANGS.includes(l) ? l : 'en');

function t(lang, key, params = {}) {
    const entry = M[key];
    if (!entry) return key;
    const tpl = entry[normLang(lang)] || entry.en;
    return tpl.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''));
}

/** Localise a crop/weather word if we know it, otherwise return as-is. */
function w(lang, word) {
    if (!word) return word;
    const l = normLang(lang);
    if (l === 'en') return word;
    return WORDS[word]?.[l] || WORDS[String(word).toLowerCase()]?.[l] || word;
}

function when(lang, dayIndex) {
    if (dayIndex === 0) return t(lang, 'today');
    if (dayIndex === 1) return t(lang, 'tomorrow');
    return t(lang, 'in_days', { n: dayIndex });
}

module.exports = { t, w, when, normLang, LANGS };
