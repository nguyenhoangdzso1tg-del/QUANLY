import { db } from "./firebase.js";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

let allData = [];
let lastDeleted = null;
let deleteTimeout = null;
const tbody = document.getElementById("list");

/* ===== MULTI-SELECT STATE ===== */
let isSelectMode = false;
let selectedIds = new Set();

const q = query(
  collection(db, "violations"),
  orderBy("createdAt", "desc"),
  limit(200)
);

onSnapshot(q, (snapshot) => {
  allData = [];

  snapshot.forEach(d => {
    allData.push({
      id: d.id,
      ...d.data()
    });
  });

  // Sắp xếp mới nhất trước
  allData.sort((a, b) => {
    if (!a.createdAt || !b.createdAt) return 0;
    return b.createdAt.seconds - a.createdAt.seconds;
  });

  // Giữ lại selectedIds còn tồn tại
  const existingIds = new Set(allData.map(v => v.id));
  selectedIds = new Set([...selectedIds].filter(id => existingIds.has(id)));
  updateSelectedCount();

  if (isFiltering && currentFilterDate) {
    const filtered = allData.filter(v => v.ngay === currentFilterDate);
    renderTable(filtered);
  } else {
    renderTable(allData);
  }
});

/* ===== SINGLE DELETE (giữ nguyên) ===== */
function attachDeleteEvents() {
  document.querySelectorAll(".btn-delete").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;

      if (!confirm("Bạn có chắc muốn xóa vi phạm này?")) return;

      const item = allData.find(v => v.id === id);
      lastDeleted = item;

      allData = allData.filter(v => v.id !== id);
      selectedIds.delete(id);
      updateSelectedCount();
      renderTable(getCurrentDisplayData());

      showUndoToast();

      deleteTimeout = setTimeout(async () => {
        await deleteDoc(doc(db, "violations", id));
        lastDeleted = null;
      }, 8000);
    };
  });
}

/* ===== MULTI-SELECT EVENTS ===== */
function attachSelectEvents() {
  document.querySelectorAll(".row-checkbox").forEach(cb => {
    cb.onchange = () => {
      const id = cb.dataset.id;
      if (cb.checked) {
        selectedIds.add(id);
        cb.closest("tr").classList.add("selected-row");
      } else {
        selectedIds.delete(id);
        cb.closest("tr").classList.remove("selected-row");
      }
      updateSelectedCount();
      syncSelectAllCheckbox();
    };
  });
}

function updateSelectedCount() {
  const el = document.getElementById("selectedCount");
  if (el) el.innerText = selectedIds.size;
}

function syncSelectAllCheckbox() {
  const headerCb = document.getElementById("selectAllHeader");
  const topCb = document.getElementById("selectAll");
  const rowCbs = document.querySelectorAll(".row-checkbox");
  if (!rowCbs.length) {
    if (headerCb) headerCb.checked = false;
    if (topCb) topCb.checked = false;
    return;
  }
  const allChecked = [...rowCbs].every(cb => cb.checked);
  if (headerCb) headerCb.checked = allChecked;
  if (topCb) topCb.checked = allChecked;
}

function getCurrentDisplayData() {
  if (isFiltering && currentFilterDate) {
    return allData.filter(v => v.ngay === currentFilterDate);
  }
  return allData;
}

function renderTable(data) {
  tbody.innerHTML = "";

  const colCount = isSelectMode ? 12 : 11;

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${colCount}" class="empty">
          Không có vi phạm
        </td>
      </tr>
    `;
    return;
  }

  let displayData = data;

  // Chỉ phân trang khi "Tất cả"
  if (!isFiltering) {
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    displayData = data.slice(start, end);
  }

  displayData.forEach(v => {
    let time = "—";
    if (v.createdAt) {
      time = v.createdAt.toDate().toLocaleString("vi-VN");
    }

    const isChecked = selectedIds.has(v.id);
    const selectCell = isSelectMode
      ? `<td class="col-select show">
           <input type="checkbox" class="select-checkbox row-checkbox" data-id="${v.id}" ${isChecked ? "checked" : ""}>
         </td>`
      : `<td class="col-select"></td>`;

    const tr = document.createElement("tr");
    if (isChecked) tr.classList.add("selected-row");

    tr.innerHTML = `
      ${selectCell}
      <td>${v.maSV}</td>
      <td>${v.hoTen}</td>
      <td>${v.lop}</td>
      <td>${v.khoaHoc}</td>
      <td>${v.khoa}</td>
      <td>${v.ngay}</td>
      <td>${v.buoi}</td>
      <td>${v.vipham}</td>
      <td>${time}</td>
      <td>${v.nguoiNhap || "—"}</td>
      <td>
        <button class="btn-delete" data-id="${v.id}">X</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  attachDeleteEvents();
  if (isSelectMode) {
    attachSelectEvents();
    syncSelectAllCheckbox();
  }

  // Chỉ render pagination khi "Tất cả"
  if (!isFiltering) {
    renderPagination(data.length);
  } else {
    document.getElementById("pagination").innerHTML = "";
    document.getElementById("paginationTop").innerHTML = "";
  }
}

/* ===== FILTER ===== */
document.getElementById("btnFilter").onclick = () => {
  const date = document.getElementById("filterDate").value;
  if (!date) return;

  isFiltering = true;
  currentFilterDate = date;
  currentPage = 1;

  const filtered = allData.filter(v => v.ngay === date);
  renderTable(filtered);
};

document.getElementById("btnClear").onclick = () => {
  isFiltering = false;
  currentFilterDate = null;
  currentPage = 1;
  renderTable(allData);
};

let currentFilterDate = null;
let currentPage = 1;
const perPage = 50;
let isFiltering = false;

function renderPagination(totalItems) {
  const totalPages = Math.ceil(totalItems / perPage);

  const containerBottom = document.getElementById("pagination");
  const containerTop = document.getElementById("paginationTop");

  containerBottom.innerHTML = "";
  containerTop.innerHTML = "";

  if (totalPages <= 1) return;

  function createBtn(page, text = page) {
    const btn = document.createElement("button");
    btn.innerText = text;

    btn.onclick = () => {
      currentPage = page;
      renderTable(getCurrentDisplayData());
    };

    if (page === currentPage) {
      btn.style.background = "#2563eb";
      btn.style.color = "white";
    }

    return btn;
  }

  function render(container) {
    if (currentPage > 1) {
      container.appendChild(createBtn(currentPage - 1, "←"));
    }

    container.appendChild(createBtn(1));

    if (currentPage > 3) {
      const dot = document.createElement("span");
      dot.innerText = "...";
      container.appendChild(dot);
    }

    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
      if (i > 1 && i < totalPages) {
        container.appendChild(createBtn(i));
      }
    }

    if (currentPage < totalPages - 2) {
      const dot = document.createElement("span");
      dot.innerText = "...";
      container.appendChild(dot);
    }

    if (totalPages > 1) {
      container.appendChild(createBtn(totalPages));
    }

    if (currentPage < totalPages) {
      container.appendChild(createBtn(currentPage + 1, "→"));
    }
  }

  render(containerTop);
  render(containerBottom);
}

/* ===== UNDO (giữ nguyên single delete) ===== */
function showUndoToast() {
  const toast = document.getElementById("undoToast");
  toast.style.display = "block";

  setTimeout(() => {
    toast.style.display = "none";
  }, 5000);
}

window.undoDelete = function () {
  if (!lastDeleted) return;

  clearTimeout(deleteTimeout);

  allData.unshift(lastDeleted);
  renderTable(getCurrentDisplayData());

  lastDeleted = null;

  document.getElementById("undoToast").style.display = "none";
};

/* ===== MULTI DELETE UI ===== */
function enterSelectMode() {
  isSelectMode = true;
  selectedIds.clear();
  updateSelectedCount();

  document.getElementById("btnTrash").classList.add("active");
  document.getElementById("btnConfirmDelete").classList.add("show");
  document.getElementById("btnCancelSelect").classList.add("show");
  document.getElementById("selectAllWrap").classList.add("show");
  document.getElementById("thSelect").classList.add("show");
  document.querySelectorAll(".col-select").forEach(el => el.classList.add("show"));

  renderTable(getCurrentDisplayData());
}

function exitSelectMode() {
  isSelectMode = false;
  selectedIds.clear();
  updateSelectedCount();

  document.getElementById("btnTrash").classList.remove("active");
  document.getElementById("btnConfirmDelete").classList.remove("show");
  document.getElementById("btnCancelSelect").classList.remove("show");
  document.getElementById("selectAllWrap").classList.remove("show");
  document.getElementById("thSelect").classList.remove("show");

  const headerCb = document.getElementById("selectAllHeader");
  const topCb = document.getElementById("selectAll");
  if (headerCb) headerCb.checked = false;
  if (topCb) topCb.checked = false;

  renderTable(getCurrentDisplayData());
}

document.getElementById("btnTrash").onclick = () => {
  if (isSelectMode) {
    exitSelectMode();
  } else {
    enterSelectMode();
  }
};

document.getElementById("btnCancelSelect").onclick = () => {
  exitSelectMode();
};

/* Chọn tất cả (header + top) */
function toggleSelectAll(checked) {
  const rowCbs = document.querySelectorAll(".row-checkbox");
  rowCbs.forEach(cb => {
    cb.checked = checked;
    const id = cb.dataset.id;
    if (checked) {
      selectedIds.add(id);
      cb.closest("tr").classList.add("selected-row");
    } else {
      selectedIds.delete(id);
      cb.closest("tr").classList.remove("selected-row");
    }
  });
  updateSelectedCount();
  const headerCb = document.getElementById("selectAllHeader");
  const topCb = document.getElementById("selectAll");
  if (headerCb) headerCb.checked = checked;
  if (topCb) topCb.checked = checked;
}

document.getElementById("selectAllHeader").onchange = (e) => {
  toggleSelectAll(e.target.checked);
};
document.getElementById("selectAll").onchange = (e) => {
  toggleSelectAll(e.target.checked);
};

/* Xóa nhiều đã chọn */
document.getElementById("btnConfirmDelete").onclick = async () => {
  if (selectedIds.size === 0) {
    alert("Chưa chọn vi phạm nào!");
    return;
  }

  const count = selectedIds.size;
  if (!confirm(`Bạn có chắc muốn xóa ${count} vi phạm đã chọn?`)) return;

  const idsToDelete = [...selectedIds];

  // Xóa tạm trên UI
  allData = allData.filter(v => !selectedIds.has(v.id));
  selectedIds.clear();
  updateSelectedCount();
  renderTable(getCurrentDisplayData());

  // Xóa thật trên Firebase
  try {
    await Promise.all(
      idsToDelete.map(id => deleteDoc(doc(db, "violations", id)))
    );
  } catch (err) {
    console.error("Lỗi xóa nhiều:", err);
    alert("Có lỗi khi xóa một số bản ghi. Vui lòng tải lại trang.");
  }

  exitSelectMode();
};