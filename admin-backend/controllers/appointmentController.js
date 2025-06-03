const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");

exports.getAllAppointments = async (req, res) => {
  const appointments = await Appointment.find()
    .populate("doctorId", "name")
    .populate("patientId", "name");
  const data = appointments.map((a) => ({
    _id: a._id,
    date: a.date,
    status: a.status,
    doctorName: a.doctorId?.name || "N/A",
    patientName: a.patientId?.name || "N/A",
  }));
  res.json(data);
};

exports.updateAppointmentStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  await Appointment.findByIdAndUpdate(id, { status });
  res.json({ message: "Appointment status updated" });
};
