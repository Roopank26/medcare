import React, { useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/AuthContext";
import { updateUserProfile } from "../../firebase/firestore";
import { MedicalDisclaimer, Spinner } from "./UI";
import { validateName } from "../../utils/validation";
import { sanitizeName, sanitizeText, sanitizeEmail } from "../../utils/sanitize";
import useToast from "../../hooks/useToast";

const CONDITIONS  = ["None","Hypertension","Diabetes","Asthma","Heart Disease","Arthritis","Thyroid Disorder","Anxiety/Depression","Other"];
const SPECIALTIES = ["General Practice","Cardiology","Neurology","Oncology","Pediatrics","Orthopedics","Dermatology","Psychiatry","Endocrinology","Pulmonology","Other"];
const BLOOD_GROUPS = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];

const InfoRow = ({ label, value }) => (
  <div className="flex items-start justify-between py-3 border-b border-gray-50 last:border-0 gap-4">
    <span className="text-sm text-gray-500 flex-shrink-0 min-w-[140px]">{label}</span>
    <span className="text-sm font-semibold text-gray-900 text-right break-words max-w-[60%]">{value || "—"}</span>
  </div>
);

const Profile = () => {
  const { user, refreshProfile } = useAuth();
  const toast   = useToast();
  const isDoc   = user?.role === "doctor";

  const [editing, setEditing]   = useState(false);
  const [saving,  setSaving]    = useState(false);
  const [fieldErr, setFieldErr] = useState({});

  const [form, setForm] = useState({
    name:             user?.name              || "",
    phone:            user?.phone             || "",
    gender:           user?.gender            || "",
    dateOfBirth:      user?.dateOfBirth       || "",
    address:          user?.address           || "",
    // Patient
    bloodGroup:       user?.bloodGroup        || "",
    knownConditions:  user?.knownConditions   || "None",
    allergies:        user?.allergies         || "",
    emergencyContact: user?.emergencyContact  || "",
    // Doctor
    specialty:        user?.specialty         || "",
    licenseNumber:    user?.licenseNumber     || "",
    hospital:         user?.hospital          || "",
    experience:       user?.experience        || "",
  });

  const onChange = useCallback((e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFieldErr((prev) => ({ ...prev, [e.target.name]: null }));
  }, []);

  const validate = () => {
    const errs = {};
    const nameCheck = validateName(form.name);
    if (!nameCheck.valid) errs.name = nameCheck.error;
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    const sanitized = {
      name:             sanitizeName(form.name),
      phone:            sanitizeText(form.phone, 20),
      gender:           form.gender,
      dateOfBirth:      form.dateOfBirth,
      address:          sanitizeText(form.address, 200),
      bloodGroup:       form.bloodGroup,
      knownConditions:  form.knownConditions,
      allergies:        sanitizeText(form.allergies, 200),
      emergencyContact: sanitizeText(form.emergencyContact, 100),
      specialty:        form.specialty,
      licenseNumber:    sanitizeText(form.licenseNumber, 50),
      hospital:         sanitizeText(form.hospital, 100),
      experience:       form.experience,
    };

    const { error: err } = await updateUserProfile(user.uid, sanitized);
    setSaving(false);
    if (err) { toast.error("Could not save profile: " + err); return; }

    await refreshProfile();
    toast.success("Profile updated successfully!");
    setEditing(false);
  };

  const initials = (user?.name || "U")
    .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const inputCls = (name) =>
    `input-field ${fieldErr[name] ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""}`;

  return (
    <>
      <Helmet>
        <title>My Profile — Medcare</title>
      </Helmet>

      <div className="animate-fade-in space-y-6 max-w-3xl">
        {/* Profile header */}
        <div className="card">
          <div className="flex items-start gap-5 flex-wrap">
            <div className="relative flex-shrink-0">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-white font-display font-bold text-2xl shadow-md ${
                isDoc ? "bg-gradient-to-br from-secondary to-secondary-600" : "bg-gradient-to-br from-primary to-primary-600"
              }`}>
                {initials}
              </div>
              <div className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs ${isDoc ? "bg-secondary" : "bg-primary"}`}>
                {isDoc ? "👨‍⚕️" : "👤"}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="font-display font-bold text-2xl text-gray-900">{user?.name}</h2>
                  <p className="text-gray-500 text-sm mt-0.5">{user?.email}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${isDoc ? "bg-secondary-50 text-secondary-700" : "bg-primary-50 text-primary"}`}>
                      {user?.role}
                    </span>
                    {isDoc && form.specialty && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{form.specialty}</span>
                    )}
                    {!isDoc && form.bloodGroup && (
                      <span className="text-xs text-red-600 bg-red-50 px-2.5 py-1 rounded-full font-bold">
                        Blood: {form.bloodGroup}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setEditing(!editing); setFieldErr({}); }}
                  className={editing ? "btn-outline text-sm" : "btn-primary text-sm"}
                >
                  {editing ? "Cancel" : "✏️ Edit Profile"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="card border border-primary-100 animate-fade-in">
            <h3 className="font-display font-semibold text-gray-900 mb-5">Edit Profile</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Common */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name *</label>
                <input name="name" value={form.name} onChange={onChange} className={inputCls("name")} placeholder="Your full name" />
                {fieldErr.name && <p className="text-red-500 text-xs mt-1">{fieldErr.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                <input name="phone" value={form.phone} onChange={onChange} className="input-field" placeholder="+1 (555) 000-0000" maxLength={20} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Gender</label>
                <select name="gender" value={form.gender} onChange={onChange} className="input-field">
                  <option value="">Select</option>
                  {["Male","Female","Non-binary","Prefer not to say"].map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date of Birth</label>
                <input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={onChange} className="input-field" />
              </div>

              {/* Patient-specific */}
              {!isDoc && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Blood Group</label>
                    <select name="bloodGroup" value={form.bloodGroup} onChange={onChange} className="input-field">
                      <option value="">Select</option>
                      {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Known Conditions</label>
                    <select name="knownConditions" value={form.knownConditions} onChange={onChange} className="input-field">
                      {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Known Allergies</label>
                    <input name="allergies" value={form.allergies} onChange={onChange} className="input-field" placeholder="e.g., Penicillin, Peanuts" maxLength={200} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Emergency Contact</label>
                    <input name="emergencyContact" value={form.emergencyContact} onChange={onChange} className="input-field" placeholder="Name — Phone" maxLength={100} />
                  </div>
                </>
              )}

              {/* Doctor-specific */}
              {isDoc && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Specialty</label>
                    <select name="specialty" value={form.specialty} onChange={onChange} className="input-field">
                      <option value="">Select specialty</option>
                      {SPECIALTIES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">License Number</label>
                    <input name="licenseNumber" value={form.licenseNumber} onChange={onChange} className="input-field" placeholder="Medical license #" maxLength={50} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Hospital / Clinic</label>
                    <input name="hospital" value={form.hospital} onChange={onChange} className="input-field" placeholder="Hospital name" maxLength={100} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Years of Experience</label>
                    <input type="number" name="experience" value={form.experience} onChange={onChange} className="input-field" min="0" max="60" />
                  </div>
                </>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Address</label>
                <input name="address" value={form.address} onChange={onChange} className="input-field" placeholder="City, State, Country" maxLength={200} />
              </div>
            </div>

            <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <><Spinner size={4} />Saving…</> : "Save Changes"}
              </button>
              <button onClick={() => setEditing(false)} className="btn-outline">Cancel</button>
            </div>
          </div>
        )}

        {/* Display */}
        {!editing && (
          <>
            <div className="card">
              <h3 className="font-display font-semibold text-gray-900 mb-4">
                {isDoc ? "Professional Information" : "Personal Information"}
              </h3>
              <InfoRow label="Full Name"    value={form.name}        />
              <InfoRow label="Email"        value={user?.email}      />
              <InfoRow label="Phone"        value={form.phone}       />
              <InfoRow label="Gender"       value={form.gender}      />
              <InfoRow label="Date of Birth"value={form.dateOfBirth} />
              <InfoRow label="Address"      value={form.address}     />
              {isDoc ? (
                <>
                  <InfoRow label="Specialty"       value={form.specialty}     />
                  <InfoRow label="License Number"  value={form.licenseNumber} />
                  <InfoRow label="Hospital"        value={form.hospital}      />
                  <InfoRow label="Experience"      value={form.experience ? `${form.experience} years` : ""} />
                </>
              ) : (
                <>
                  <InfoRow label="Blood Group"       value={form.bloodGroup}       />
                  <InfoRow label="Known Conditions"  value={form.knownConditions}  />
                  <InfoRow label="Allergies"         value={form.allergies}        />
                  <InfoRow label="Emergency Contact" value={form.emergencyContact} />
                </>
              )}
            </div>

            <div className="card">
              <h3 className="font-display font-semibold text-gray-900 mb-4">Account & Security</h3>
              <InfoRow label="Email"          value={user?.email} />
              <InfoRow label="Authentication" value="Firebase Email + Password" />
              <InfoRow label="Role"           value={user?.role}  />
              <div className="py-3 flex items-center justify-between gap-4">
                <span className="text-sm text-gray-500">Firebase Project</span>
                <span className="text-xs text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full font-semibold">
                  🔥 madecare-9b986
                </span>
              </div>
            </div>
          </>
        )}

        <MedicalDisclaimer compact />
      </div>
    </>
  );
};

export default React.memo(Profile);
