import { auth } from "./firebase.js";
import { db } from "./firebase.js";
import {
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
function getWeekNumber(date) {
  const d = new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export async function sendViolations(violationList) {

  for (const v of violationList) {

  const selectedDate = new Date(v["Ngày"]); // ✅ PHẢI ĐẶT Ở ĐÂY

  await addDoc(collection(db, "violations"), {
    maSV: v["Mã SV"],
    hoTen: v["Họ tên"],
    lop: v["Lớp"],
    khoaHoc: v["Khóa"],
    khoa: v["Khoa"],
    ngay: v["Ngày"],
    
    buoi: v["Buổi"],
    vipham: v["Vi phạm"],

    createdAt: serverTimestamp(),

    // ✅ PHÂN LOẠI ĐÚNG
    year: selectedDate.getFullYear(),
    month: selectedDate.getMonth() + 1,
    day: selectedDate.getDate(),
    week: getWeekNumber(selectedDate),
    dateKey: v["Ngày"], 
    nguoiNhap: localStorage.getItem("nguoiNhap")
  });
}
}