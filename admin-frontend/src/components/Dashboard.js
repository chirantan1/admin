import React, { useEffect, useState } from "react";
import api from "../api";
import { jsPDF } from "jspdf";
import "./Dashboard.css";

const Dashboard = () => {
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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

  const deleteUser = async (type, id) => {
    const confirmMsg = `Are you sure you want to delete this ${type}?`;
    if (window.confirm(confirmMsg)) {
      try {
        await api.delete(`/${type}s/${id}`);
        fetchAllData();
      } catch (err) {
        console.error(`Failed to delete ${type}:`, err);
      }
    }
  };

const generateBillPDF = (appointment) => {
  const doc = new jsPDF();
  
  // Clinic Information
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 82, 186); // Dark blue
  doc.text("MediCare Clinic", 105, 25, null, null, "center");
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text("123 Health Avenue, Medical City", 105, 32, null, null, "center");
  doc.text("Phone: (555) 123-4567 | Email: info@medicareclinic.com", 105, 38, null, null, "center");
  
  
  
  // Document Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(220, 53, 69); // Red color
  doc.text("APPOINTMENT INVOICE", 105, 50, null, null, "center");
  
  // Invoice Header
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 55, 190, 55);
  
  // Invoice Details
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
  
  // Patient and Doctor Information
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
  
  // Appointment Details
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 82, 186);
  doc.text("APPOINTMENT DETAILS", 20, patientInfoY + 30);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(`Date: ${new Date(appointment.date).toLocaleDateString()}`, 20, patientInfoY + 38);
  doc.text(`Time: ${new Date(appointment.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`, 20, patientInfoY + 44);
  doc.text(`Duration: 30 mins`, 20, patientInfoY + 50);
  
  // Status with colored badge - CORRECTED SYNTAX
  const status = appointment.status || "completed";
  if (status === "completed") {
    doc.setFillColor(40, 167, 69); // green
  } else if (status === "pending") {
    doc.setFillColor(255, 193, 7); // yellow
  } else {
    doc.setFillColor(220, 53, 69); // red
  }
  doc.roundedRect(110, patientInfoY + 34, 30, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(status.toUpperCase(), 125, patientInfoY + 40, null, null, "center");
  
  // Charges Table
  const tableY = patientInfoY + 65;
  
  // Table Header
  doc.setFillColor(15, 82, 186);
  doc.rect(20, tableY, 170, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPTION", 25, tableY + 7);
  doc.text("AMOUNT (₹)", 165, tableY + 7, null, null, "right");
  
  // Table Rows
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  
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
  
  // Total
  const totalAmount = charges.reduce((sum, c) => sum + c.amount, 0);
  
  doc.setFillColor(240, 240, 240);
  doc.rect(20, currentY, 170, 15, 'F');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL", 25, currentY + 10);
  doc.text(`₹ ${totalAmount.toFixed(2)}`, 165, currentY + 10, null, null, "right");
  
  // Payment Method
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Payment Method: Credit Card (Paid)", 20, currentY + 25);
  doc.text("Transaction ID: XXXX-XXXX-XXXX-1234", 20, currentY + 30);
  
  // Footer
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  
  doc.text("For any inquiries, please contact our billing department at billing@medicareclinic.com", 105, 285, null, null, "center");
  
  // Terms and Conditions
  doc.setFontSize(8);
  doc.text("Terms & Conditions:", 20, 270);
  doc.text("1. Payment is due within 15 days of invoice date.", 20, 275);
  doc.text("2. Late payments may be subject to a 1.5% monthly interest charge.", 20, 280);
  
  // Watermark
  doc.setFontSize(60);
  doc.setTextColor(230, 230, 230);
  doc.setFont("helvetica", "bold");
  doc.text("PAID", 105, 150, null, null, "center");
  
  // Save the PDF
  doc.save(`Invoice_${appointment._id.slice(-8)}_${appointment.patientName || 'Patient'}.pdf`);
};

  // Add filteredDoctors here to fix the error
  const filteredDoctors = doctors.filter((doc) =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dashboard-container">
      <header>
        <h1>Admin Dashboard</h1>
      </header>

      <section className="summary-cards">
        <Card title="Doctors" count={doctors.length} icon="🩺" />
        <Card title="Patients" count={patients.length} icon="🧑‍🤝‍🧑" />
        <Card title="Appointments" count={appointments.length} icon="📅" />
      </section>

      <section className="search-section">
        <input
          type="text"
          placeholder="Search doctor by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </section>

      {loading ? (
        <div className="loading">Loading data...</div>
      ) : (
        <>
          <Section title="Doctors" data={filteredDoctors} type="doctor" onDelete={deleteUser} />
          <Section title="Patients" data={patients} type="patient" onDelete={deleteUser} />
          <AppointmentsSection appointments={appointments} onGenerateBill={generateBillPDF} />
        </>
      )}
    </div>
  );
};

// Card Component
const Card = ({ title, count, icon }) => (
  <div className="card">
    <div className="card-icon">{icon}</div>
    <div className="card-info">
      <h3>{title}</h3>
      <p>{count}</p>
    </div>
  </div>
);

// Doctors & Patients Section
const Section = ({ title, data, type, onDelete }) => (
  <section className="list-section">
    <h2>{title}</h2>
    {data.length === 0 ? (
      <p className="empty-message">No {title.toLowerCase()} found.</p>
    ) : (
      <ul className="list">
        {data.map((item) => (
          <li key={item._id} className={`list-item ${type}`}>
            <div>
              <strong>
                {type === "doctor" ? `Dr. ${item.name}` : item.name}
              </strong>{" "}
              {type === "doctor" ? (
                <span className="specialty">({item.specialty || "General"})</span>
              ) : (
                <span>({item.email})</span>
              )}
            </div>
            <button
              className="btn btn-danger"
              onClick={() => onDelete(type, item._id)}
              title={`Delete ${type}`}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    )}
  </section>
);

// Appointments Section
const AppointmentsSection = ({ appointments, onGenerateBill }) => (
  <section className="list-section">
    <h2>Appointments</h2>
    {appointments.length === 0 ? (
      <p className="empty-message">No appointments found.</p>
    ) : (
      <ul className="list appointments">
        {appointments.map((apt) => (
          <li key={apt._id} className="list-item appointment">
            <div>
              <span className="date">
                📅 {new Date(apt.date).toLocaleDateString()}
              </span>{" "}
              <span>
                <strong>{apt.patientName}</strong> with{" "}
                <strong>{apt.doctorName}</strong>
              </span>{" "}
              <span className={`status ${apt.status.toLowerCase()}`}>
                [{apt.status}]
              </span>
            </div>
            <button
              className="btn btn-primary generate-bill-btn"
              onClick={() => onGenerateBill(apt)}
              title="Generate Bill PDF"
            >
              Generate Bill
            </button>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export default Dashboard;
