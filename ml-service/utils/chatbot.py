"""
Medcare ML - Chatbot Utility
Uses OpenAI GPT with a healthcare-focused system prompt.
Falls back to rule-based responses when no API key is configured.
"""

import os, re

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

SYSTEM_PROMPT = """You are MedBot, a friendly and knowledgeable AI healthcare assistant integrated into the Medcare platform. Your role is to:

1. Answer general health questions clearly and compassionately
2. Help users understand their symptoms and when to seek care
3. Provide evidence-based health information
4. Encourage professional medical consultation for serious concerns
5. Offer general wellness and prevention advice

Important rules:
- ALWAYS clarify you are an AI and not a doctor
- NEVER provide specific diagnoses or prescribe medications
- Always recommend seeing a doctor for serious or persistent symptoms
- Keep responses concise (2-4 paragraphs max)
- Use plain language, avoid excessive medical jargon
- Be empathetic and supportive
- End serious queries with: "Please consult a qualified healthcare professional."

You can discuss: symptoms, general health advice, nutrition, mental wellness, medication reminders (general), when to see a doctor, preventive care, and healthy lifestyle tips."""

# ── Rule-based fallback responses ─────────────────────────────────────────
FALLBACK_RULES = [
    (r"(hello|hi|hey|good\s*(morning|afternoon|evening))",
     "Hello! I'm MedBot, your AI health assistant on Medcare. I can answer general health questions, help you understand symptoms, and guide you on when to seek medical care. How can I help you today?"),

    (r"(headache|head\s*ache|head\s*pain|migraine)",
     "Headaches are very common and usually not serious. Common triggers include dehydration, eye strain, stress, poor sleep, or tension. Try drinking water, resting in a dark room, and taking an OTC pain reliever. If your headache is severe, sudden, or accompanied by fever and stiff neck, seek emergency care immediately."),

    (r"(fever|temperature|hot|chills)",
     "A fever is usually a sign your immune system is fighting an infection. Stay well-hydrated, rest, and take paracetamol or ibuprofen to manage the fever. Seek medical care if: fever exceeds 103F (39.4C), lasts more than 3 days, or is accompanied by severe symptoms like stiff neck or rash."),

    (r"(cough|coughing|throat)",
     "A cough is often caused by a viral infection like a cold or flu. Stay hydrated, use honey in warm water, and try steam inhalation. See a doctor if the cough persists for more than 2-3 weeks, produces blood, or is accompanied by breathing difficulty."),

    (r"(stomach|nausea|vomit|diarrhea|digestion|abdominal)",
     "Gastrointestinal issues are common and often resolve on their own. Try the BRAT diet (Bananas, Rice, Applesauce, Toast), stay hydrated with oral rehydration solutions, and rest. See a doctor if symptoms persist beyond 48 hours, you're severely dehydrated, or there's blood in stool or vomit."),

    (r"(diabetes|blood\s*sugar|insulin)",
     "Diabetes is managed through diet, exercise, and medication. If you're experiencing symptoms like excessive thirst, frequent urination, and fatigue, get a blood glucose test. Always follow your doctor's prescribed treatment plan and check blood sugar regularly."),

    (r"(blood\s*pressure|hypertension|bp)",
     "Hypertension (high blood pressure) often has no symptoms, which is why it's called the 'silent killer.' Lifestyle changes like reducing salt, exercising, and managing stress help. If you're on medication, take it as prescribed. Always monitor your BP regularly and consult your doctor for adjustments."),

    (r"(anxiety|stress|panic|worry|mental\s*health)",
     "Mental health is just as important as physical health. For anxiety: try deep breathing exercises, mindfulness, or progressive muscle relaxation. Regular exercise, adequate sleep, and social connection also help significantly. If anxiety is interfering with daily life, please consider speaking with a mental health professional - it's a sign of strength, not weakness."),

    (r"(sleep|insomnia|cant\s*sleep|tired)",
     "Good sleep is essential for health. For better sleep: maintain a consistent sleep schedule, avoid screens 1 hour before bed, keep your bedroom cool and dark, and avoid caffeine after noon. If insomnia persists for weeks, speak to a doctor about cognitive behavioral therapy for insomnia (CBT-I)."),

    (r"(diet|nutrition|eat|food|weight)",
     "A balanced diet is the foundation of good health. Focus on: plenty of vegetables and fruits, lean proteins, whole grains, and healthy fats like nuts and olive oil. Limit processed foods, added sugars, and excessive salt. Aim for regular meals and don't skip breakfast. A registered dietitian can create a personalized plan."),

    (r"(exercise|workout|physical\s*activity|fitness)",
     "The WHO recommends 150 minutes of moderate aerobic activity per week. Walking, swimming, and cycling are excellent low-impact options. Combine with strength training 2x/week. Even 10-minute walks throughout the day add up significantly. Always warm up and cool down to prevent injury."),

    (r"(medication|medicine|drug|pill|dose)",
     "I can provide general information about medications, but specific dosing and prescription decisions must come from your doctor or pharmacist. Never self-prescribe antibiotics. Always complete prescribed courses fully. Check for interactions if taking multiple medications."),

    (r"(emergency|urgent|severe|911|ambulance)",
     "[EMERGENCY] If this is a medical emergency, please call emergency services (911) immediately or go to the nearest emergency room. Do not delay. Signs of emergency: chest pain, difficulty breathing, severe allergic reaction, sudden numbness or paralysis, confusion, or heavy bleeding."),

    (r"(pregnancy|pregnant|prenatal)",
     "Pregnancy requires specialized medical care. Ensure you have regular prenatal check-ups, take prescribed prenatal vitamins (especially folic acid), avoid alcohol and smoking, stay hydrated, and get appropriate exercise. Any unusual symptoms during pregnancy should be discussed with your OB/GYN promptly."),

    (r"(covid|coronavirus|covid-19)",
     "If you suspect COVID-19: isolate immediately, get tested, monitor your oxygen levels (seek care if below 94%), stay hydrated, and rest. Seek emergency care for severe breathlessness. Follow current public health guidelines in your region."),

    (r"(vaccine|vaccination|immunization)",
     "Vaccines are safe and highly effective at preventing serious diseases. Keep your vaccinations up to date - this includes annual flu shots, COVID-19 boosters, and other routine vaccines. Ask your doctor which vaccines are recommended for your age and health status."),
]


def rule_based_response(message: str) -> str | None:
    """Return a rule-based response if the message matches a known pattern."""
    msg_lower = message.lower()
    for pattern, response in FALLBACK_RULES:
        if re.search(pattern, msg_lower):
            return response
    return None


def get_chat_response(messages):
    """
    Get a chatbot response.
    - Uses OpenAI GPT if API key is configured
    - Falls back to rule-based system otherwise
    """

    user_message = messages[-1]["content"] if messages else ""

    # ── Try OpenAI ─────────────────────────────────────────
    if OPENAI_AVAILABLE and OPENAI_API_KEY and OPENAI_API_KEY != "your-key-here":
        try:
            client = OpenAI(api_key=OPENAI_API_KEY)
            full_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            # Include conversation history (last 10 messages)
            full_messages += messages[-10:]

            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=full_messages,
                max_tokens=400,
                temperature=0.7,
            )
            reply = response.choices[0].message.content
            return {
                "reply":   reply,
                "source":  "openai",
                "error":   None,
            }
        except Exception as e:
            print(f"OpenAI error: {e} - falling back to rule-based")

    # ── Rule-based fallback ────────────────────────────────
    reply = rule_based_response(user_message)

    if not reply:
        reply = (
            "That's a great health question! While I can provide general health information, "
            "I recommend consulting a qualified healthcare professional for personalized advice. "
            "In the meantime, feel free to use Medcare's symptom checker for a preliminary assessment. "
            "Is there anything specific I can help clarify?"
            "\n\n*This platform provides AI-based suggestions and is not a medical diagnosis system.*"
        )

    return {
        "reply":  reply,
        "source": "rule-based",
        "error":  None,
    }
