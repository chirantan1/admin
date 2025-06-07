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

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [doctorRes, patientRes, appointmentRes] = await Promise.all([
        api.get("/doctors"),
        api.get("/patients"),
        api.get("/appointments"),
      ]);
      setDoctors(doctorRes.data);
      setPatients(patientRes.data);
      setAppointments(appointmentRes.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (type, id) => {
    if (window.confirm(`Are you sure you want to delete this ${type}?`)) {
      try {
        await api.delete(`/${type}s/${id}`);
        fetchAllData();
      } catch (err) {
        console.error(`Failed to delete ${type}:`, err);
      }
    }
  };

  const deleteAppointment = async (id) => {
    if (window.confirm("Are you sure you want to delete this appointment?")) {
      try {
        await api.delete(`/appointments/${id}`);
        fetchAllData();
      } catch (err) {
        console.error("Failed to delete appointment:", err);
      }
    }
  };

  const handleViewDetails = (type, item) => {
    setSelectedItem(item);
    setViewType(type);
  };

  const generateBillPDF = (appointment) => {
    const doc = new jsPDF();
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 82, 186);
    doc.text("MediCare Clinic", 105, 25, null, null, "center");
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("123 Health Avenue, Medical City", 105, 32, null, null, "center");
    doc.text("Phone: (555) 123-4567 | Email: info@medicareclinic.com", 105, 38, null, null, "center");
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 53, 69);
    doc.text("APPOINTMENT INVOICE", 105, 50, null, null, "center");
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 55, 190, 55);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("INVOICE #:", 20, 65);
    doc.text("DATE:", 20, 70);
    doc.text("PATIENT ID:", 20, 75);
    doc.setFont("helvetica", "normal");
    doc.text(appointment._id.slice(-8).toUpperCase(), 40, 65);
    doc.text(new Date().toLocaleDateString(), 40, 70);
    doc.text(appointment.patientId ? appointment.patientId.slice(-6).toUpperCase() : "N/A", 40, 75);
    
    const patientInfoY = 90;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 82, 186);
    doc.text("BILL TO:", 20, patientInfoY);
    doc.text("DOCTOR:", 110, patientInfoY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(appointment.patientName || "Patient Name", 20, patientInfoY + 7);
    doc.text(appointment.doctorName || "Dr. Smith", 110, patientInfoY + 7);
    doc.setFontSize(10);
    doc.text("Phone: " + (appointment.patientPhone || "N/A"), 20, patientInfoY + 14);
    doc.text("Specialty: " + (appointment.doctorSpecialty || "General"), 110, patientInfoY + 14);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 82, 186);
    doc.text("APPOINTMENT DETAILS", 20, patientInfoY + 30);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(`Date: ${new Date(appointment.date).toLocaleDateString()}`, 20, patientInfoY + 38);
    doc.text(`Time: ${new Date(appointment.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`, 20, patientInfoY + 44);
    doc.text(`Duration: 30 mins`, 20, patientInfoY + 50);
    
    const status = appointment.status || "completed";
    if (status === "completed") doc.setFillColor(40, 167, 69);
    else if (status === "pending") doc.setFillColor(255, 193, 7);
    else doc.setFillColor(220, 53, 69);
    doc.roundedRect(110, patientInfoY + 34, 30, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(status.toUpperCase(), 125, patientInfoY + 40, null, null, "center");

    const tableY = patientInfoY + 65;
    doc.setFillColor(15, 82, 186);
    doc.rect(20, tableY, 170, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIPTION", 25, tableY + 7);
    doc.text("AMOUNT (Rs.)", 165, tableY + 7, null, null, "right");

    const charges = [
      { desc: "Consultation Fee", amount: 750.00 },
      { desc: "Medical Examination", amount: 350.00 },
      { desc: "Service Tax (18%)", amount: 198.00 },
      { desc: "Facility Charges", amount: 150.00 }
    ];
    
    let currentY = tableY + 10;
    charges.forEach((item, index) => {
      doc.setFillColor(index % 2 === 0 ? 240 : 255, index % 2 === 0 ? 240 : 255, index % 2 === 0 ? 240 : 255);
      doc.rect(20, currentY, 170, 10, 'F');
      doc.text(item.desc, 25, currentY + 7);
      doc.text(`₹ ${item.amount.toFixed(2)}`, 165, currentY + 7, null, null, "right");
      currentY += 10;
    });

    const totalAmount = charges.reduce((sum, c) => sum + c.amount, 0);
    doc.setFillColor(240, 240, 240);
    doc.rect(20, currentY, 170, 15, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("TOTAL", 25, currentY + 10);
    doc.text(`₹ ${totalAmount.toFixed(2)}`, 165, currentY + 10, null, null, "right");
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Payment Method: Credit Card (Paid)", 20, currentY + 25);
    doc.text("Transaction ID: XXXX-XXXX-XXXX-1234", 20, currentY + 30);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("For any inquiries, please contact our billing department at billing@medicareclinic.com", 105, 285, null, null, "center");
    doc.setFontSize(8);
    doc.text("Terms & Conditions:", 20, 270);
    doc.text("1. Payment is due within 15 days of invoice date.", 20, 275);
    doc.text("2. Late payments may be subject to a 1.5% monthly interest charge.", 20, 280);
    
    doc.setFontSize(60);
    doc.setTextColor(230, 230, 230);
    doc.setFont("helvetica", "bold");
    doc.text("PAID", 105, 150, null, null, "center");
    doc.save(`Invoice_${appointment._id.slice(-8)}_${appointment.patientName || 'Patient'}.pdf`);
  };

  const filteredDoctors = doctors.filter((doc) =>
    doc.name.toLowerCase().includes(doctorSearchTerm.toLowerCase())
  );

  const filteredPatients = patients.filter((patient) =>
    patient.name.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
    patient.email.toLowerCase().includes(patientSearchTerm.toLowerCase())
  );

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Admin Dashboard</h1>
      </header>

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
          />
        </>
      )}

      {selectedItem && (
        <div className={`modal-overlay ${selectedItem ? 'active' : ''}`}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {viewType === "doctor" ? "Doctor Details" : "Patient Details"}
              </h2>
              <button 
                className="modal-close" 
                onClick={() => setSelectedItem(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <ul className="details-list">
                {Object.entries(selectedItem).map(([key, value]) => (
                  <li key={key} className="detail-item">
                    <strong>{key}:</strong> <span>{String(value)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setSelectedItem(null)}
              >
                Close
              </button>
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
    <h2>{title}</h2>
    {data.length === 0 ? (
      <p className="empty-message">No {title.toLowerCase()} found.</p>
    ) : (
      <ul className="list">
        {data.map((item) => (
          <li key={item._id} className={`list-item ${type}`}>
            <div className="list-item-content">
              <strong 
                className="clickable" 
                onClick={() => onView(type, item)}
              >
                {type === "doctor" ? `Dr. ${item.name}` : item.name}
              </strong>{" "}
              {type === "doctor" ? (
                <span className="specialty">({item.specialty || "General"})</span>
              ) : (
                <span className="email">({item.email})</span>
              )}
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

const AppointmentsSection = ({ appointments, onGenerateBill, onDelete }) => (
  <section className="list-section">
    <h2>Appointments</h2>
    {appointments.length === 0 ? (
      <p className="empty-message">No appointments found.</p>
    ) : (
      <ul className="list appointments">
        {appointments.map((apt) => (
          <li key={apt._id} className="list-item appointment">
            <div className="appointment-info">
              <span className="date">📅 {new Date(apt.date).toLocaleDateString()}</span>{" "}
              <span>
                <strong>{apt.patientName}</strong> with <strong>{apt.doctorName}</strong>
              </span>{" "}
              <span className={`status ${apt.status ? apt.status.toLowerCase() : 'completed'}`}>
                [{apt.status || "completed"}]
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