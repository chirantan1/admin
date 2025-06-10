import React, { useEffect, useState } from "react";
import api from "../api";
import { jsPDF } from "jspdf";
import "./Dashboard.css";

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

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [doctorRes, patientRes, appointmentRes] = await Promise.all([
        api.get("/doctors").catch(() => ({ data: [] })),
        api.get("/patients").catch(() => ({ data: [] })),
        api.get("/appointments").catch(() => ({ data: [] }))
      ]);
      
      setDoctors(doctorRes.data || []);
      setPatients(patientRes.data || []);
      
      // Enhance appointments with doctor and patient names
      const enhancedAppointments = (appointmentRes.data || []).map(apt => {
        const doctor = (doctorRes.data || []).find(d => d._id === apt.doctorId) || {};
        const patient = (patientRes.data || []).find(p => p._id === apt.patientId) || {};
        return {
          ...apt,
          doctorName: doctor.name || "Unknown Doctor",
          patientName: patient.name || "Unknown Patient"
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
      // Use plural endpoint (doctors, patients)
      await api.delete(`/${type}s/${id}`);
      fetchAllData();
    } catch (err) {
      console.error(`Failed to delete ${type}:`, err);
      setError(`Failed to delete ${type}. Please try again.`);
    }
  };

  const deleteAppointment = async (id) => {
    if (!window.confirm("Are you sure you want to delete this appointment?")) return;
    
    try {
      await api.delete(`/appointments/${id}`);
      fetchAllData();
    } catch (err) {
      console.error("Failed to delete appointment:", err);
      setError("Failed to delete appointment. Please try again.");
    }
  };

  const handleViewDetails = (type, item) => {
    setSelectedItem(item);
    setViewType(type);
  };

  const generateBillPDF = async (appointment) => {
    try {
      // Fetch complete doctor and patient details with error handling
      const [doctorRes, patientRes] = await Promise.all([
        api.get(`/doctors/${appointment.doctorId}`).catch(() => ({ data: {} })),
        api.get(`/patients/${appointment.patientId}`).catch(() => ({ data: {} }))
      ]);

      const doctor = doctorRes.data || {};
      const patient = patientRes.data || {};

      const doc = new jsPDF();
      
      // Clinic Header
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 82, 186);
      doc.text("MediCare Clinic", 105, 25, null, null, "center");
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text("123 Health Avenue, Medical City", 105, 32, null, null, "center");
      doc.text("Phone: (555) 123-4567 | Email: info@medicareclinic.com", 105, 38, null, null, "center");
      
      // Invoice Title
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 53, 69);
      doc.text("APPOINTMENT INVOICE", 105, 50, null, null, "center");
      doc.line(20, 55, 190, 55);

      // Invoice Details
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("INVOICE #:", 20, 65);
      doc.text("DATE:", 20, 70);
      doc.text("APPOINTMENT ID:", 20, 75);
      doc.setFont("helvetica", "normal");
      doc.text(`MC-${appointment._id.slice(-8).toUpperCase()}`, 40, 65);
      doc.text(new Date().toLocaleDateString(), 40, 70);
      doc.text(`APT-${appointment._id.slice(-6).toUpperCase()}`, 40, 75);

      // Patient and Doctor Information
      const patientInfoY = 90;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 82, 186);
      doc.text("PATIENT DETAILS:", 20, patientInfoY);
      doc.text("DOCTOR DETAILS:", 110, patientInfoY);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(patient.name || "Patient Name", 20, patientInfoY + 7);
      doc.text(`Dr. ${doctor.name || "Doctor Name"}`, 110, patientInfoY + 7);
      
      doc.setFontSize(10);
      doc.text(`Phone: ${patient.phone || "N/A"}`, 20, patientInfoY + 14);
      doc.text(`Email: ${patient.email || "N/A"}`, 20, patientInfoY + 20);
      doc.text(`Address: ${patient.address || "N/A"}`, 20, patientInfoY + 26);
      
      doc.text(`Specialty: ${doctor.specialty || "General"}`, 110, patientInfoY + 14);
      doc.text(`Phone: ${doctor.phone || "N/A"}`, 110, patientInfoY + 20);
      doc.text(`Email: ${doctor.email || "N/A"}`, 110, patientInfoY + 26);

      // Appointment Details
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 82, 186);
      doc.text("APPOINTMENT INFORMATION", 20, patientInfoY + 40);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(`Date: ${new Date(appointment.date).toLocaleDateString()}`, 20, patientInfoY + 48);
      doc.text(`Time: ${new Date(appointment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 20, patientInfoY + 54);
      doc.text(`Duration: ${appointment.duration || 30} mins`, 20, patientInfoY + 60);
      doc.text(`Reason: ${appointment.reason || "Regular checkup"}`, 20, patientInfoY + 66);

      // Status Badge
      const status = appointment.status || "completed";
      const statusColor = status === "completed" ? [40, 167, 69] : 
                         status === "pending" ? [255, 193, 7] : [220, 53, 69];
      doc.setFillColor(...statusColor);
      doc.roundedRect(110, patientInfoY + 44, 30, 10, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(status.toUpperCase(), 125, patientInfoY + 50, null, null, "center");

      // Charges Table
      const tableY = patientInfoY + 80;
      doc.setFillColor(15, 82, 186);
      doc.rect(20, tableY, 170, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("DESCRIPTION", 25, tableY + 7);
      doc.text("AMOUNT (Rs.)", 165, tableY + 7, null, null, "right");

      // Calculate charges based on specialty and duration
      const baseConsultationFee = doctor.specialty === "Cardiology" ? 1000 : 
                                doctor.specialty === "Neurology" ? 1200 : 750;
      const durationMultiplier = (appointment.duration || 30) / 30;
      const consultationFee = baseConsultationFee * durationMultiplier;
      
      const charges = [
        { desc: `${doctor.specialty || "General"} Consultation`, amount: consultationFee },
        { desc: "Medical Examination", amount: 350.0 },
        { desc: "Service Tax (18%)", amount: consultationFee * 0.18 },
        { desc: "Facility Charges", amount: 150.0 },
      ];

      let currentY = tableY + 10;
      charges.forEach((item, index) => {
        doc.setFillColor(index % 2 === 0 ? 245 : 255);
        doc.rect(20, currentY, 170, 10, "F");
        doc.setTextColor(0, 0, 0);
        doc.text(item.desc, 25, currentY + 7);
        doc.text(`₹ ${item.amount.toFixed(2)}`, 165, currentY + 7, null, null, "right");
        currentY += 10;
      });

      // Total Amount
      const totalAmount = charges.reduce((sum, c) => sum + c.amount, 0);
      doc.setFillColor(240, 240, 240);
      doc.rect(20, currentY, 170, 15, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("TOTAL", 25, currentY + 10);
      doc.text(`₹ ${totalAmount.toFixed(2)}`, 165, currentY + 10, null, null, "right");

      // Payment Information
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Payment Method: Credit Card (Paid)", 20, currentY + 25);
      doc.text(`Transaction ID: MC-${Date.now().toString().slice(-8)}`, 20, currentY + 30);
      
      // Footer Notes
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("For any inquiries, please contact our billing department at billing@medicareclinic.com", 105, 285, null, null, "center");
      
      doc.setFontSize(8);
      doc.text("Terms & Conditions:", 20, 270);
      doc.text("1. Payment is due within 15 days of invoice date.", 20, 275);
      doc.text("2. Late payments may be subject to a 1.5% monthly interest charge.", 20, 280);
      doc.text("3. This is an electronically generated invoice, no signature required.", 20, 285);

      // Watermark
      doc.setFontSize(60);
      doc.setTextColor(230, 230, 230);
      doc.setFont("helvetica", "bold");
      doc.text("PAID", 105, 150, null, null, "center");

      // Save the PDF with fallback for missing names
      const patientNameFallback = patient.name || "Patient";
      const fileName = `Invoice_MC-${appointment._id.slice(-8)}_${patientNameFallback.replace(/\s+/g, '_')}.pdf`;
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

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <p className="dashboard-subtitle">Manage doctors, patients, and appointments</p>
      </header>

      {error && (
        <div className="alert alert-danger">
          {error}
          <button className="close-btn" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <section className="summary-cards">
        <Card title="Doctors" count={doctors.length} icon="🩺" type="doctor" />
        <Card title="Patients" count={patients.length} icon="🧑‍🤝‍🧑" type="patient" />
        <Card title="Appointments" count={appointments.length} icon="📅" type="appointment" />
      </section>

      <section className="search-section">
        <div className="search-group">
          <input
            type="text"
            placeholder="Search doctors by name..."
            value={doctorSearchTerm}
            onChange={(e) => setDoctorSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="search-group">
          <input
            type="text"
            placeholder="Search patients by name or email..."
            value={patientSearchTerm}
            onChange={(e) => setPatientSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </section>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <span>Loading data...</span>
        </div>
      ) : (
        <>
          <Section 
            title="Doctors" 
            data={filteredDoctors} 
            type="doctor" 
            onDelete={deleteItem} 
            onView={handleViewDetails} 
          />
          <Section 
            title="Patients" 
            data={filteredPatients} 
            type="patient" 
            onDelete={deleteItem} 
            onView={handleViewDetails} 
          />
          <AppointmentsSection 
            appointments={appointments} 
            onGenerateBill={generateBillPDF} 
            onDelete={deleteAppointment} 
            onView={handleViewDetails}
          />
        </>
      )}

      {selectedItem && (
        <div className="modal-overlay active" onClick={() => setSelectedItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{viewType === "doctor" ? "Doctor Details" : 
                   viewType === "patient" ? "Patient Details" : "Appointment Details"}</h2>
              <button className="modal-close" onClick={() => setSelectedItem(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                {Object.entries(selectedItem).map(([key, value]) => {
                  if (key === 'doctorName' || key === 'patientName') return null;
                  if (Array.isArray(value) && value.length === 0) return null;
                  if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) return null;
                  
                  const displayKey = key === '_id' 
                    ? (viewType === 'doctor' ? 'Doctor ID' : 
                       viewType === 'patient' ? 'Patient ID' : 
                       'Appointment ID')
                    : key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                  
                  return (
                    <div className="detail-row" key={key}>
                      <div className="detail-label">{displayKey}:</div>
                      <div className="detail-value">
                        {value === null || value === undefined ? 'N/A' : 
                         typeof value === 'boolean' ? (value ? 'Yes' : 'No') :
                         typeof value === 'object' ? JSON.stringify(value) : 
                         String(value)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setSelectedItem(null)}
              >
                Close
              </button>
              {viewType === 'appointment' && (
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    generateBillPDF(selectedItem);
                    setSelectedItem(null);
                  }}
                >
                  Generate Bill
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Card = ({ title, count, icon, type }) => (
  <div className={`card ${type}`}>
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
              <div className="avatar">{item.name?.charAt(0) || '?'}</div>
              <div className="item-details">
                <strong 
                  className="clickable" 
                  onClick={() => onView(type, item)}
                >
                  {type === "doctor" ? `Dr. ${item.name}` : item.name}
                </strong>
                {type === "doctor" ? (
                  <>
                    <span className="specialty">{item.specialty || ""}</span>
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

const AppointmentsSection = ({ appointments, onGenerateBill, onDelete, onView }) => (
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
                  {new Date(apt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
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
                onClick={() => window.open("https://payment-1-sv5s.onrender.com", "_blank")}
              >
                Payment
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

export default Dashboard;