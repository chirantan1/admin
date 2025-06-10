import React, { useEffect, useState } from "react";
import api from "../api";
import { jsPDF } from "jspdf";
import "./Dashboard.css"; // Assuming you have this CSS file

const Dashboard = () => {
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [doctorSearchTerm, setDoctorSearchTerm] = useState("");
  const [patientSearchTerm, setPatientSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [viewType, setViewType] = useState("");
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("doctors");

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [doctorRes, patientRes, appointmentRes] = await Promise.all([
        api.get("/doctors").catch((err) => {
          console.error("Error fetching doctors:", err);
          return { data: [] };
        }),
        api.get("/patients").catch((err) => {
          console.error("Error fetching patients:", err);
          return { data: [] };
        }),
        api.get("/appointments").catch((err) => {
          console.error("Error fetching appointments:", err);
          return { data: [] };
        }),
      ]);

      setDoctors(doctorRes.data || []);
      setPatients(patientRes.data || []);

      // FIX: Use the populated doctor and patient data directly from the backend's appointment response
      const enhancedAppointments = (appointmentRes.data || []).map((apt) => {
        return {
          ...apt,
          // apt.doctor and apt.patient are now objects because of backend populate
          doctorName: apt.doctor?.name || "Unknown Doctor",
          patientName: apt.patient?.name || "Unknown Patient",
          // Keep doctorId and patientId for other operations if needed,
          // but the names are already available through the nested objects.
          doctorId: apt.doctor?.id || apt.doctorId, // Ensure the ID is available if backend uses different key
          patientId: apt.patient?.id || apt.patientId, // Ensure the ID is available if backend uses different key
        };
      });

      setAppointments(enhancedAppointments);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to fetch data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (type, id) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      await api.delete(`/${type}s/${id}`);
      fetchAllData();
    } catch (err) {
      console.error(`Failed to delete ${type}:`, err);
      setError(`Failed to delete ${type}. Please try again.`);
    }
  };

  const deleteAppointment = async (id) => {
    if (!window.confirm("Are you sure you want to delete this appointment?"))
      return;

    try {
      await api.delete(`/appointments/${id}`);
      fetchAllData();
    } catch (err) {
      console.error("Failed to delete appointment:", err);
      setError("Failed to delete appointment. Please try again.");
    }
  };

  const handleViewDetails = (type, item) => {
    if (type === "appointment") {
      // FIX: The `item` now directly contains `item.doctor` and `item.patient` objects
      // because the backend is populating them.
      setSelectedItem({
        ...item,
        doctorDetails: item.doctor || {}, // Use the nested doctor object
        patientDetails: item.patient || {}, // Use the nested patient object
      });
    } else {
      setSelectedItem(item);
    }
    setViewType(type);
  };

  const generateBillPDF = async (appointment) => {
    try {
      // FIX: Use the already available nested doctor and patient objects from the appointment.
      // No need to make separate API calls here since the appointment data is already rich.
      const doctor = appointment.doctor || {};
      const patient = appointment.patient || {};

      const doc = new jsPDF();

      doc.setFontSize(22);
      doc.setTextColor("#333366");
      doc.text("MediCare Clinic - Appointment Invoice", 105, 20, null, null, "center");

      doc.setFontSize(10);
      doc.setTextColor("#666666");
      doc.text("123 Health Ave, Wellness City", 105, 27, null, null, "center");
      doc.text("Phone: (123) 456-7890 | Email: info@medicare.com", 105, 32, null, null, "center");

      doc.setDrawColor("#333366");
      doc.line(20, 38, 190, 38);

      doc.setFontSize(12);
      doc.setTextColor("#333333");
      doc.text(`Invoice ID: MC-${appointment._id.slice(-8)}`, 20, 48);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 190, 48, null, null, "right");

      doc.setDrawColor("#CCCCCC");
      doc.line(20, 52, 190, 52);

      // Patient Information
      doc.setFontSize(14);
      doc.setTextColor("#333366");
      doc.text("Patient Information:", 20, 60);
      doc.setFontSize(12);
      doc.setTextColor("#333333");
      doc.text(`Name: ${patient.name || "N/A"}`, 20, 67);
      doc.text(`Email: ${patient.email || "N/A"}`, 20, 74);
      doc.text(`Phone: ${patient.phone || "N/A"}`, 20, 81);

      // Doctor Information
      doc.setFontSize(14);
      doc.setTextColor("#333366");
      doc.text("Doctor Information:", 105, 60);
      doc.setFontSize(12);
      doc.setTextColor("#333333");
      doc.text(`Name: Dr. ${doctor.name || "N/A"}`, 105, 67);
      doc.text(`Specialty: ${doctor.specialty || "N/A"}`, 105, 74);
      doc.text(`Email: ${doctor.email || "N/A"}`, 105, 81); // Assuming doctors have an email field

      doc.line(20, 88, 190, 88);

      // Appointment Details
      doc.setFontSize(14);
      doc.setTextColor("#333366");
      doc.text("Appointment Details:", 20, 96);
      doc.setFontSize(12);
      doc.setTextColor("#333333");
      doc.text(`Appointment Date: ${new Date(appointment.date).toLocaleDateString()}`, 20, 103);
      doc.text(`Appointment Time: ${new Date(appointment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 20, 110);
      doc.text(`Reason: ${appointment.reason || "N/A"}`, 20, 117);
      doc.text(`Status: ${appointment.status || "N/A"}`, 20, 124);

      doc.line(20, 131, 190, 131);

      // Billing Summary (Example, adjust as per your actual billing logic)
      doc.setFontSize(14);
      doc.setTextColor("#333366");
      doc.text("Billing Summary:", 20, 139);
      doc.setFontSize(12);
      doc.setTextColor("#333333");

      const serviceFee = 50.00;
      const consultationFee = 150.00;
      const totalAmount = serviceFee + consultationFee;

      doc.text(`Consultation Fee: $${consultationFee.toFixed(2)}`, 20, 146);
      doc.text(`Service Fee: $${serviceFee.toFixed(2)}`, 20, 153);
      doc.setFontSize(14);
      doc.setTextColor("#006600");
      doc.text(`Total Amount: $${totalAmount.toFixed(2)}`, 20, 165);

      doc.line(20, 172, 190, 172);

      // Footer
      doc.setFontSize(10);
      doc.setTextColor("#666666");
      doc.text("Thank you for choosing MediCare Clinic. For inquiries, please contact us.", 105, 280, null, null, "center");

      const patientNameFallback = patient.name || "Patient";
      const fileName = `Invoice_MC-${appointment._id.slice(-8)}_${patientNameFallback.replace(/\s+/g, "_")}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error("Error generating bill:", err);
      setError("Failed to generate bill. Please try again.");
    }
  };

  const filteredDoctors = doctors.filter((doc) =>
    doc.name?.toLowerCase().includes(doctorSearchTerm.toLowerCase())
  );

  const filteredPatients = patients.filter(
    (patient) =>
      patient.name?.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
      patient.email?.toLowerCase().includes(patientSearchTerm.toLowerCase())
  );

  // FIX: Ensure filteredAppointments uses the new 'doctorName' and 'patientName' fields
  const filteredAppointments = appointments.filter((apt) => {
    const matchesDoctor = apt.doctorName?.toLowerCase().includes(doctorSearchTerm.toLowerCase());
    const matchesPatient = apt.patientName?.toLowerCase().includes(patientSearchTerm.toLowerCase());
    return matchesDoctor || matchesPatient;
  });

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>MediCare Clinic Dashboard</h1>
        <p className="dashboard-subtitle">
          Manage your healthcare system efficiently
        </p>
      </header>

      {error && (
        <div className="alert alert-danger">
          {error}
          <button className="close-btn" onClick={() => setError(null)}>
            &times;
          </button>
        </div>
      )}

      <section className="summary-cards">
        <Card
          title="Doctors"
          count={doctors.length}
          icon="🩺"
          type="doctor"
          onClick={() => setActiveTab("doctors")}
          active={activeTab === "doctors"}
        />
        <Card
          title="Patients"
          count={patients.length}
          icon="🧑‍🤝‍🧑"
          type="patient"
          onClick={() => setActiveTab("patients")}
          active={activeTab === "patients"}
        />
        <Card
          title="Appointments"
          count={appointments.length}
          icon="📅"
          type="appointment"
          onClick={() => setActiveTab("appointments")}
          active={activeTab === "appointments"}
        />
      </section>

      <section className="search-section">
        <div className="search-group">
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={activeTab === "doctors" ? doctorSearchTerm : patientSearchTerm}
            onChange={(e) =>
              activeTab === "doctors"
                ? setDoctorSearchTerm(e.target.value)
                : setPatientSearchTerm(e.target.value)
            }
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
      </section>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <span>Loading data...</span>
        </div>
      ) : (
        <div className="content-section">
          {activeTab === "doctors" && (
            <Section
              title="Doctors"
              data={filteredDoctors}
              type="doctor"
              onDelete={deleteItem}
              onView={handleViewDetails}
            />
          )}
          {activeTab === "patients" && (
            <Section
              title="Patients"
              data={filteredPatients}
              type="patient"
              onDelete={deleteItem}
              onView={handleViewDetails}
            />
          )}
          {activeTab === "appointments" && (
            <AppointmentsSection
              appointments={filteredAppointments}
              onGenerateBill={generateBillPDF}
              onDelete={deleteAppointment}
              onView={handleViewDetails}
            />
          )}
        </div>
      )}

      {selectedItem && (
        <DetailModal
          selectedItem={selectedItem}
          viewType={viewType}
          onClose={() => setSelectedItem(null)}
          onGenerateBill={generateBillPDF}
        />
      )}
    </div>
  );
};

const Card = ({ title, count, icon, type, onClick, active }) => (
  <div className={`card ${type} ${active ? "active" : ""}`} onClick={onClick}>
    <div className="card-icon">{icon}</div>
    <div className="card-info">
      <h3>{title}</h3>
      <p>{count}</p>
    </div>
  </div>
);

const Section = ({ title, data, type, onDelete, onView }) => (
  <section className="list-section">
    <div className="section-header">
      <h2>{title}</h2>
      <span className="badge">{data.length}</span>
    </div>
    {data.length === 0 ? (
      <p className="empty-message">No {title.toLowerCase()} found.</p>
    ) : (
      <ul className="list">
        {data.map((item) => (
          <li key={item._id} className={`list-item ${type}`}>
            <div className="list-item-content">
              <div className="avatar" style={{ backgroundColor: getRandomColor() }}>
                {item.name?.charAt(0) || "?"}
              </div>
              <div className="item-details">
                <strong
                  className="clickable"
                  onClick={() => onView(type, item)}
                >
                  {type === "doctor" ? `Dr. ${item.name}` : item.name}
                </strong>
                {type === "doctor" ? (
                  <>
                    <span className="specialty">
                      {item.specialty || "General"}
                    </span>
                    <span className="id">ID: {item._id.slice(-6)}</span>
                  </>
                ) : (
                  <>
                    <span className="email">{item.email}</span>
                    <span className="id">ID: {item._id.slice(-6)}</span>
                  </>
                )}
              </div>
            </div>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => onDelete(type, item._id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    )}
  </section>
);

const AppointmentsSection = ({
  appointments,
  onGenerateBill,
  onDelete,
  onView,
}) => (
  <section className="list-section">
    <div className="section-header">
      <h2>Appointments</h2>
      <span className="badge">{appointments.length}</span>
    </div>
    {appointments.length === 0 ? (
      <p className="empty-message">No appointments found.</p>
    ) : (
      <ul className="list appointments">
        {appointments.map((apt) => (
          <li key={apt._id} className="list-item appointment">
            <div className="appointment-info">
              <div className="appointment-time">
                <span className="date">
                  {new Date(apt.date).toLocaleDateString()}
                </span>
                <span className="time">
                  {new Date(apt.date).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <div className="appointment-parties">
                {/* FIX: Use doctorName and patientName which are now derived from populated data */}
                <span className="doctor">Dr. {apt.doctorName}</span>
                <span className="patient">{apt.patientName}</span>
              </div>

              <span className={`status ${apt.status?.toLowerCase() || "completed"}`}>
                {apt.status || "completed"}
              </span>
            </div>
            <div className="appointment-actions">
              <button
                className="btn btn-primary generate-bill-btn"
                onClick={() => onGenerateBill(apt)}
              >
                Generate Bill
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => onView("appointment", apt)}
              >
                Details
              </button>
              <button
                className="btn btn-danger"
                onClick={() => onDelete(apt._id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    )}
  </section>
);

const DetailModal = ({ selectedItem, viewType, onClose, onGenerateBill }) => {
  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {viewType === "doctor"
              ? "Doctor Details"
              : viewType === "patient"
              ? "Patient Details"
              : "Appointment Details"}
          </h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="detail-grid">
            {Object.entries(selectedItem).map(([key, value]) => {
              // Exclude internal Mongoose fields and the temporary names created on frontend
              if (
                key === "_id" ||
                key === "__v" ||
                key === "password" ||
                key === "doctorId" || // Exclude these, as we're showing the nested 'doctor' object
                key === "patientId" || // Exclude these, as we're showing the nested 'patient' object
                key === "doctorName" || // Exclude temporary display name
                key === "patientName" || // Exclude temporary display name
                (Array.isArray(value) && value.length === 0) ||
                (typeof value === "object" && value !== null && Object.keys(value).length === 0)
              )
                return null;

              // FIX: Handle the 'doctor' and 'patient' objects directly from the backend
              if (viewType === "appointment" && (key === "doctor" || key === "patient")) {
                const subTitle = key === "doctor" ? "Doctor Information" : "Patient Information";
                const details = value; // This is the populated object (e.g., selectedItem.doctor)
                return (
                  <React.Fragment key={key}>
                    <div className="detail-category">{subTitle}</div>
                    {Object.entries(details).map(([subKey, subValue]) => {
                      if (
                        subKey === "_id" ||
                        subKey === "__v" ||
                        subKey === "password" ||
                        (typeof subValue === 'object' && subValue !== null && Object.keys(subValue).length === 0)
                      ) return null;
                      const displaySubKey = subKey
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (str) => str.toUpperCase());
                      return (
                        <div className="detail-row" key={`${key}-${subKey}`}>
                          <div className="detail-label">{displaySubKey}:</div>
                          <div className="detail-value">
                            {subValue === null || subValue === undefined
                              ? "N/A"
                              : typeof subValue === "boolean"
                              ? subValue
                                ? "Yes"
                                : "No"
                              : String(subValue)}
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              }

              // Format date/time fields for better display
              if (['date', 'createdAt', 'updatedAt'].includes(key)) {
                if (value) {
                  value = new Date(value).toLocaleString();
                }
              }

              const displayKey =
                key === "_id"
                  ? viewType === "doctor"
                    ? "Doctor ID"
                    : viewType === "patient"
                    ? "Patient ID"
                    : "Appointment ID"
                  : key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());

              return (
                <div className="detail-row" key={key}>
                  <div className="detail-label">{displayKey}:</div>
                  <div className="detail-value">
                    {value === null || value === undefined
                      ? "N/A"
                      : typeof value === "boolean"
                      ? value
                        ? "Yes"
                        : "No"
                      : typeof value === "object" // Fallback for any other unexpected objects
                      ? JSON.stringify(value)
                      : String(value)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {viewType === "appointment" && (
            <button
              className="btn btn-primary"
              onClick={() => {
                onGenerateBill(selectedItem);
                onClose();
              }}
            >
              Generate Bill
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to generate random colors for avatars
const getRandomColor = () => {
  const colors = [
    "#FF6633",
    "#FFB399",
    "#FF33FF",
    "#FFFF99",
    "#00B3E6",
    "#E6B333",
    "#3366E6",
    "#999966",
    "#99FF99",
    "#B34D4D",
    "#80B300",
    "#809900",
    "#E6B3B3",
    "#6680B3",
    "#66991A",
    "#FF99E6",
    "#CCFF1A",
    "#FF1A66",
    "#E6331A",
    "#33FFCC",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export default Dashboard;