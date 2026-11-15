const str = (description) => ({ type: 'string', description });
const tool = (name, description, properties = {}, required = []) => ({
  type: 'function',
  name,
  description,
  parameters: { type: 'object', properties, required, additionalProperties: false },
});

const DATE = 'Date as YYYY-MM-DD (clinic local time).';
const TIME = 'Time as 24-hour HH:MM.';
const PHONE = 'Bangladeshi mobile number, exactly as the caller said it (Bangla or English digits).';

/** Tool definitions sent to the Realtime session. Keep in sync with contracts/agent-tools.md. */
export const AGENT_TOOLS = [
  tool('get_current_datetime', 'Get the current date, time and weekday in Dhaka. Use it to turn "next Sunday" or "tomorrow" into a real date.'),
  tool('get_clinic_info', 'Get the clinic name, phone, address, directions, and opening hours. Always use this for hours or location questions.'),
  tool('list_doctors', 'List the doctors with their specialty, working days and hours.'),
  tool('list_skills', 'List the topics the clinic has information about (services, fees, policies, FAQs).'),
  tool('get_skill', 'Get the full details of one knowledge topic by its exact title from the list in the prompt. Use this first when the caller asks about a listed service, fee, policy or FAQ.', { title: str('The exact title, as listed in the prompt.') }, ['title']),
  tool('lookup_skill', 'Search the clinic knowledge by the caller\'s own words when no listed title fits, or when no list is shown. Matches titles, keywords and details.', { query: str('What the caller asked about, in Bangla or English.') }, ['query']),
  tool(
    'check_availability',
    'Find free appointment slots on a date.',
    { date: str(DATE), doctor_name: str('Optional doctor name.'), period: { type: 'string', enum: ['morning', 'afternoon', 'evening'], description: 'Optional part of the day.' } },
    ['date'],
  ),
  tool(
    'book_appointment',
    'Book an appointment. Only call after the caller confirmed name, phone, date and time.',
    { patient_name: str('Full name.'), phone: str(PHONE), reason: str('Reason for the visit.'), date: str(DATE), time: str(TIME), doctor_name: str('Optional doctor name.') },
    ['patient_name', 'phone', 'reason', 'date', 'time'],
  ),
  tool(
    'reschedule_appointment',
    'Move the caller\'s upcoming appointment to a new date and time.',
    { phone: str(PHONE), new_date: str(DATE), new_time: str(TIME), old_date: str('Current appointment date, only if the caller has several.'), doctor_name: str('Optional doctor name.') },
    ['phone', 'new_date', 'new_time'],
  ),
  tool('cancel_appointment', 'Cancel the caller\'s upcoming appointment.', { phone: str(PHONE), date: str('Appointment date, only if the caller has several.') }, ['phone']),
  tool(
    'save_patient_details',
    'Save details as you learn them during the call, even when no booking is made.',
    {
      patient_name: str('Full name.'),
      phone: str(PHONE),
      reason: str('Reason for the visit.'),
      preferred_datetime_text: str('Preferred date and time as the caller said it.'),
      intent: { type: 'string', enum: ['booking', 'reschedule', 'cancel', 'enquiry', 'callback', 'other'] },
      notes: str('Anything else staff should know.'),
    },
  ),
  tool(
    'request_human_callback',
    'Pass the caller to a human: a staff member will phone them. Use it when you cannot handle the situation yourself (emergency, complaint, medical question, the booking system failing, anything the tools cannot answer, or the caller asks for a person). Collect name, phone and reason first.',
    { name: str('Caller name.'), phone: str(PHONE), reason: str('What happened and what the caller needs, in one or two clear English sentences for the staff.'), preferred_time: str('When they want the call.'), urgent: { type: 'boolean', description: 'True for pain emergencies, swelling, bleeding, accidents or an upset caller: staff call these first.' } },
    ['name', 'phone', 'reason'],
  ),
  tool('end_call', 'End the call. Call it only after you said goodbye and summarised what was agreed.'),
];
