import React, { useEffect, useState } from "react";
import axios from "axios";
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

  /* ------------------------------------------------------------------ */
  /*  Axios helpers                                                     */
  /* ------------------------------------------------------------------ */
  const api = axios.create({
    baseURL: "https://project1-backend-d55g.onrender.com/api",
  });

  const setAuthToken = (token) => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common["Authorization"];
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Initial fetch                                                     */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      setAuthToken(token);

      const [doctorRes, patientRes, appointmentRes] = await Promise.all([
        api.get("/doctors"),
        api.get("/patients"),
        api.get("/appointments"),
      ]);
      setDoctors(doctorRes.data?.data || []);
      setPatients(patientRes.data?.data || []);
      setAppointments(appointmentRes.data?.data || []);
    } catch (err) {
      console.error("Error fetching data:", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("token");
        alert("Session expired or unauthorized. Please log in again.");
      }
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Deletes                                                           */
  /* ------------------------------------------------------------------ */
  const deleteItem = async (type, id) => {
    if (window.confirm(`Are you sure you want to delete this ${type}?`)) {
      try {
        const token = localStorage.getItem("token");
        setAuthToken(token);
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
        const token = localStorage.getItem("token");
        setAuthToken(token);
        await api.delete(`/appointments/${id}`);
        fetchAllData();
      } catch (err) {
        console.error("Failed to delete appointment:", err);
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /*  View & PDF helpers                                                */
  /* ------------------------------------------------------------------ */
  const handleViewDetails = (type, item) => {
    setSelectedItem(item);
    setViewType(type);
  };

  /**
   * Safely builds and downloads a simple invoice PDF for an appointment.
   * The only change from your original version is the use of optional chaining
   * (`?.`) and fall-backs (e.g. `|| "N/A"`) everywhere we used `.slice()`.
   */
  const generateBillPDF = (appointment) => {
    const doc = new jsPDF();

    /* ---------- Header ---------- */
    doc.setFontSize(20);
    doc.setTextColor(40, 53, 147);
    doc.text("Healthcare Clinic", 105, 20, null, null, "center");

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("INVOICE", 105, 30, null, null, "center");

    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, 190, 35);

    /* ---------- Clinic info ---------- */
    doc.setFontSize(10);
    doc.text("Healthcare Clinic", 20, 45);
    doc.text("123 Medical Drive", 20, 50);
    doc.text("Healthville, HV 12345", 20, 55);
    doc.text("Phone: (123) 456-7890", 20, 60);

    /* ---------- Invoice details ---------- */
    const invoiceShortId = appointment?._id?.slice?.(-6) || "------";
    const patientShortId = appointment?.patientId?.slice?.(-6) || "------";

    doc.text(`Invoice #: ${invoiceShortId}`, 150, 45);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 150, 50);
    doc.text(`Patient ID: ${patientShortId}`, 150, 55);

    /* ---------- Patient info ---------- */
    doc.setFontSize(12);
    doc.text("Bill To:", 20, 75);
    doc.setFontSize(10);

    const patient =
      patients.find((p) => p._id === appointment?.patientId) || {};

    doc.text(`Name: ${patient.name || appointment?.patientName || "N/A"}`, 20, 80);
    doc.text(`Email: ${patient.email || appointment?.patientEmail || "N/A"}`, 20, 85);
    doc.text(`Phone: ${patient.phone || appointment?.patientPhone || "N/A"}`, 20, 90);

    /* ---------- Appointment details ---------- */
    doc.setFontSize(12);
    doc.text("Appointment Details:", 20, 105);
    doc.setFontSize(10);

    const doctor =
      doctors.find((d) => d._id === appointment?.doctorId) || {};

    doc.text(
      `Date: ${appointment?.date ? new Date(appointment.date).toLocaleDateString() : "N/A"
      }`,
      20,
      110
    );
    doc.text(`Time: ${appointment?.time || "N/A"}`, 20, 115);
    doc.text(
      `Doctor: Dr. ${doctor.name || appointment?.doctorName || "N/A"}${doctor.specialization
        ? ` (${doctor.specialization})`
        : ""
      }`,
      20,
      120
    );
    doc.text(`Reason: ${appointment?.reason || "General Checkup"}`, 20, 125);

    /* ---------- Bill items ---------- */
    doc.setFontSize(12);
    doc.text("Bill Items:", 20, 140);

    // Table header
    doc.setFillColor(230, 230, 230);
    doc.rect(20, 145, 170, 10, "F");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Description", 25, 151);
    doc.text("Amount", 160, 151, null, null, "right");
    doc.setFont("helvetica", "normal");

    // Bill item rows (dummy data; replace if your API provides real prices)
    const items = [
      { description: "Consultation Fee", amount: 150 },
      { description: "Medical Tests", amount: 75 },
      { description: "Medication", amount: 50 },
    ];

    let y = 155;
    items.forEach((item) => {
      doc.text(item.description, 25, y);
      doc.text(`$${item.amount.toFixed(2)}`, 160, y, null, null, "right");
      y += 10;
    });

    // Total
    doc.setFont("helvetica", "bold");
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    doc.text("Total", 25, y + 10);
    doc.text(`$${total.toFixed(2)}`, 160, y + 10, null, null, "right");

    /* ---------- Footer ---------- */
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      "Thank you for choosing Healthcare Clinic",
      105,
      280,
      null,
      null,
      "center"
    );
    doc.text(
      "Please contact us for any questions regarding this invoice",
      105,
      285,
      null,
      null,
      "center"
    );

    /* ---------- Save ---------- */
    doc.save(`invoice_${invoiceShortId}.pdf`);
  };

  /* ------------------------------------------------------------------ */
  /*  Local search helpers                                              */
  /* ------------------------------------------------------------------ */
  const filteredDoctors = doctors.filter(
    (doc) =>
      doc.name?.toLowerCase().includes(doctorSearchTerm.toLowerCase()) ||
      doc.specialization
        ?.toLowerCase()
        .includes(doctorSearchTerm.toLowerCase())
  );

  const filteredPatients = patients.filter(
    (patient) =>
      patient.name?.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
      patient.email?.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
      patient.phone?.includes(patientSearchTerm)
  );

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Admin Dashboard</h1>
      </header>

      <section className="summary-cards">
        <Card title="Total Doctors" count={doctors.length} icon="🩺" type="doctor" />
        <Card title="Total Patients" count={patients.length} icon="🧑‍🤝‍🧑" type="patient" />
        <Card
          title="Total Appointments"
          count={appointments.length}
          icon="📅"
          type="appointment"
        />
      </section>

      <section className="search-section">
        <div className="search-group">
          <input
            type="text"
            placeholder="Search doctors by name or specialty..."
            value={doctorSearchTerm}
            onChange={(e) => setDoctorSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="search-group">
          <input
            type="text"
            placeholder="Search patients by name, email, or phone..."
            value={patientSearchTerm}
            onChange={(e) => setPatientSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </section>

      {loading ? (
        <div className="loading-spinner">
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
        <SelectedItemModal
          item={selectedItem}
          type={viewType}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Small presentational helpers                                      */
/* ------------------------------------------------------------------ */
const Card = ({ title, count, icon, type }) => {
  const getColorByType = () => {
    switch (type) {
      case "doctor":
        return "#4361ee";
      case "patient":
        return "#3a0ca3";
      case "appointment":
        return "#4cc9f0";
      default:
        return "#7209b7";
    }
  };

  return (
    <div
      className="summary-card"
      style={{ borderBottom: `4px solid ${getColorByType()}` }}
    >
      <div className="card-icon">{icon}</div>
      <div className="card-content">
        <h3>{title}</h3>
        <p className="card-count">{count}</p>
      </div>
    </div>
  );
};

const Section = ({ title, data, type, onDelete, onView }) => {
  const getFieldsByType = () => {
    switch (type) {
      case "doctor":
        return [
          { label: "Name", key: "name" },
          { label: "Specialization", key: "specialization" },
          { label: "Experience", key: "experience", suffix: "yrs" },
        ];
      case "patient":
        return [
          { label: "Name", key: "name" },
          { label: "Email", key: "email" },
          { label: "Phone", key: "phone" },
        ];
      default:
        return [];
    }
  };

  return (
    <section className="data-section">
      <h2>{title}</h2>
      {data.length === 0 ? (
        <p className="no-data">No {type}s found</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {getFieldsByType().map((field) => (
                  <th key={field.key}>{field.label}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item._id}>
                  {getFieldsByType().map((field) => (
                    <td key={`${item._id}-${field.key}`}>
                      {item[field.key]}
                      {field.suffix && ` ${field.suffix}`}
                    </td>
                  ))}
                  <td className="actions-cell">
                    <button className="view-btn" onClick={() => onView(type, item)}>
                      View
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => onDelete(type, item._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const AppointmentsSection = ({ appointments, onGenerateBill, onDelete }) => (
  <section className="data-section">
    <h2>Appointments</h2>
    {appointments.length === 0 ? (
      <p className="no-data">No appointments found</p>
    ) : (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Date</th>
              <th>Time</th>
              <th>Reason</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((appointment) => (
              <tr key={appointment._id}>
                <td>{appointment.patientName || "N/A"}</td>
                <td>{appointment.doctorName || "N/A"}</td>
                <td>
                  {appointment.date
                    ? new Date(appointment.date).toLocaleDateString()
                    : "N/A"}
                </td>
                <td>{appointment.time || "N/A"}</td>
                <td>{appointment.reason || "General Checkup"}</td>
                <td className="actions-cell">
                  <button
                    className="bill-btn"
                    onClick={() => onGenerateBill(appointment)}
                  >
                    Generate Bill
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => onDelete(appointment._id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

const SelectedItemModal = ({ item, type, onClose }) => {
  const getDetailsByType = () => {
    switch (type) {
      case "doctor":
        return [
          { label: "Name", value: item.name },
          { label: "Specialization", value: item.specialization },
          { label: "Experience", value: `${item.experience} years` },
          { label: "Email", value: item.email },
          { label: "Phone", value: item.phone },
          { label: "Address", value: item.address },
        ];
      case "patient":
        return [
          { label: "Name", value: item.name },
          { label: "Email", value: item.email },
          { label: "Phone", value: item.phone },
          { label: "Age", value: item.age },
          { label: "Gender", value: item.gender },
          { label: "Medical History", value: item.medicalHistory || "None" },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{type.charAt(0).toUpperCase() + type.slice(1)} Details</h3>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          {getDetailsByType().map((detail) => (
            <div key={detail.label} className="detail-row">
              <span className="detail-label">{detail.label}:</span>
              <span className="detail-value">{detail.value || "N/A"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
