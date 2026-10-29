
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const DB_NAME = "MyReadingRoomDB";
const DB_VERSION = 1;
const bundledBooks = [
  {
    fileName: "extract_sapiens.pdf",
    title: "Sapiens",
    coverImage: "image/sapiens.jpg"
  },
  {
    fileName: "TKMFullText.pdf",
    title: "To Kill a Mockingbird",
    coverImage: "image/TKM.jpg"
  },
  {
    fileName: "TKMFullText (1).pdf",
    title: "To Kill a Mockingbird",
    coverImage: "image/TKM.jpg"
  },
  {
    fileName: "mindset-chap-1-3.pdf",
    title: "Mindset (Chapters 1-3)",
    coverImage: "image/mindset.webp"
  },
  {
    fileName: "Thinking, Fast and Slow.pdf",
    title: "Thinking, Fast and Slow",
    coverImage: "image/thinking-fast-and-slow.jpg"
  },
  
  {
    fileName: "The-Courage-to-be-Disliked-How-to-Change-Your-Life-and-Achieve-Real-Happiness-by-Ichiro-Kishimi-Fumitake-Koga-z-lib.org_.epub_.pdf",
    title: "The Courage to Be Disliked",
    coverImage: "image/the-courage-to-be-deslike.jpg"
  },
  {
    fileName: "The_Laws_of_Human_Nature_by_Robert_Greene_2018.pdf",
    title: "The Laws of Human Nature",
    coverImage: "image/laws-of-human-nature.jpg"
  },
  {
    fileName: "what-everybody-is-saying.pdf",
    title: "What Everybody Is Saying",
    coverImage: "image/what-everybody-is-saying.jpg"
  },
  {
    fileName: "01-11-2020-205951Mindset by Carol S. Dweck.pdf",
    title: "Mindset by Carol S. Dweck",
    coverImage: "image/mindset.webp"
  }
];

let db;
let books = [];
let history = [];
let currentBook = null;
let pdfDocument = null;
let currentPageNumber = 1;
let activeSession = null;
let renderNumber = 0;

const $ = (id) => document.getElementById(id);

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains("books")) {
        database.createObjectStore("books", { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains("history")) {
        database.createObjectStore("history", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveRecord(storeName, record) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(record);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function deleteRecord(storeName, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function refreshData() {
  books = (await getAll("books")).filter((book) => !book.hidden);
  history = await getAll("history");

  const bundledOrder = new Map(
    bundledBooks.map((book, index) => [`bundled:${book.fileName}`, index])
  );
  books.sort((a, b) => {
    const addedAtDifference = (b.addedAt || 0) - (a.addedAt || 0);
    if (addedAtDifference !== 0) return addedAtDifference;

    const aOrder = bundledOrder.get(a.id);
    const bOrder = bundledOrder.get(b.id);
    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
    return 0;
  });
  history.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

  renderBooks();
  renderHistory();
  renderRecommendations();
  renderStats();
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDuration(seconds) {
  const minutes = Math.floor((seconds || 0) / 60);
  const remainingSeconds = Math.floor((seconds || 0) % 60);

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}

function renderStats() {
  const completedSessions = history.filter((item) => item.endedAt).length;
  const totalSeconds = history.reduce(
    (sum, item) => sum + (Number(item.durationSeconds) || 0),
    0
  );

  $("bookCount").textContent = books.length;
  $("sessionCount").textContent = completedSessions;
  $("readingTime").textContent =
    totalSeconds >= 3600
      ? `${Math.floor(totalSeconds / 3600)}h ${Math.floor((totalSeconds % 3600) / 60)}m`
      : `${Math.floor(totalSeconds / 60)} min`;
}

function renderBooks() {
  const query = $("searchInput").value.trim().toLowerCase();

  const filteredBooks = books.filter((book) =>
    book.title.toLowerCase().includes(query)
  );

  $("emptyLibrary").hidden = filteredBooks.length !== 0;

  $("bookGrid").innerHTML = filteredBooks.map((book) => {
    const progress = Math.min(
      100,
      Math.max(0, Number(book.progress) || 0)
    );

    const canRead = Boolean(book.pdfUrl) ||
      book.pdfData instanceof ArrayBuffer ||
      book.pdfData instanceof Blob ||
      ArrayBuffer.isView(book.pdfData);

    return `
      <article class="book-card">
        <div class="book-cover">
          ${
            book.coverImage
              ? `<img src="${escapeHTML(book.coverImage)}" alt="Cover of ${escapeHTML(book.title)}" onerror="this.hidden = true; this.nextElementSibling.hidden = false">`
              : ""
          }
          <span${book.coverImage ? " hidden" : ""}>📖</span>
        </div>
        <h3>${escapeHTML(book.title)}</h3>
        <p>${canRead ? `${progress}% completed` : "PDF needs to be added again"}</p>

        <div class="progress-track">
          <div class="progress-bar" style="width: ${progress}%"></div>
        </div>

        <div class="book-actions">
          ${
            canRead
              ? `<button class="primary-button" data-action="read" data-id="${escapeHTML(book.id)}">Read</button>`
              : `<button class="primary-button" data-action="relink" data-id="${escapeHTML(book.id)}">Relink PDF</button>`
          }
          <button class="secondary-button" data-action="rename" data-id="${escapeHTML(book.id)}">Rename</button>
          <button class="secondary-button" data-action="delete" data-id="${escapeHTML(book.id)}">Delete</button>
        </div>
      </article>
    `;
  }).join("");
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Could not read the selected cover image."));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function addPDF(file, title, coverFile) {
  if (file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")) {
    alert("Please select a PDF file.");
    return false;
  }

  if (coverFile && !coverFile.type.startsWith("image/")) {
    alert("Please select a valid image for the book cover.");
    return false;
  }

  try {
    const pdfData = await file.arrayBuffer();

    // Check that the file can be opened as a PDF before saving it.
    const testDocument = await pdfjsLib.getDocument({
      data: new Uint8Array(pdfData.slice(0))
    }).promise;

    const coverImage = coverFile ? await readFileAsDataURL(coverFile) : null;

    const book = {
      id: createId(),
      title: title.trim(),
      fileName: file.name,
      pdfData,
      coverImage,
      lastPage: 1,
      totalPages: testDocument.numPages,
      progress: 0,
      addedAt: Date.now()
    };

    await saveRecord("books", book);
    await refreshData();
    return true;
  } catch (error) {
    console.error(error);
    alert("Could not add this book. Check the PDF and cover image, then try again.");
    return false;
  }
}

async function relinkPDF(bookId, file) {
  const book = books.find((item) => item.id === bookId);
  if (!book || !file) return;

  try {
    const pdfData = await file.arrayBuffer();

    const document = await pdfjsLib.getDocument({
      data: new Uint8Array(pdfData.slice(0))
    }).promise;

    book.pdfData = pdfData;
    book.pdfUrl = null;
    book.fileName = file.name;
    book.totalPages = document.numPages;
    book.lastPage = Math.min(book.lastPage || 1, document.numPages);
    book.progress = Math.round(
      ((book.lastPage - 1) / Math.max(1, document.numPages)) * 100
    );

    await saveRecord("books", book);
    await refreshData();

    if (currentBook && currentBook.id === bookId) {
      await openBook(bookId);
    }
  } catch (error) {
    console.error(error);
    alert("Could not open that PDF.");
  }
}

async function openBook(bookId) {
  const book = books.find((item) => item.id === bookId);
  if (!book || (!book.pdfData && !book.pdfUrl)) {
    alert("Please add the PDF file for this book first.");
    return;
  }

  if (activeSession) {
    const shouldEnd = confirm(
      "You have an active reading session. End it before opening another book?"
    );

    if (!shouldEnd) return;
    await endReadingSession();
  }

  try {
    const savedPage = Number(book.lastPage) || 1;
    if (book.pdfUrl) {
      pdfDocument = await pdfjsLib.getDocument({ url: book.pdfUrl }).promise;
    } else {
      const data = book.pdfData instanceof Blob
        ? await book.pdfData.arrayBuffer()
        : book.pdfData instanceof ArrayBuffer
          ? book.pdfData.slice(0)
          : book.pdfData;

      pdfDocument = await pdfjsLib.getDocument({
        data: data instanceof ArrayBuffer ? new Uint8Array(data) : data
      }).promise;
    }

    currentBook = book;
    currentPageNumber = Math.min(savedPage, pdfDocument.numPages);

    $("readerTitle").textContent = book.title;
    $("totalPages").textContent = pdfDocument.numPages;
    $("totalPagesBottom").textContent = pdfDocument.numPages;
    $("readerSection").hidden = false;
    $("readerSection").scrollIntoView({ behavior: "smooth" });

    await renderPage(currentPageNumber);
  } catch (error) {
    console.error(error);
    alert("Could not load the PDF. Try relinking the file.");
  }
}

async function renderPage(pageNumber) {
  if (!pdfDocument) return;

  const thisRender = ++renderNumber;

  try {
    const page = await pdfDocument.getPage(pageNumber);
    const canvas = $("pdfCanvas");
    const context = canvas.getContext("2d");

    const availableWidth = Math.min(
      850,
      Math.max(280, $("readerSection").clientWidth - 70)
    );

    const initialViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1.6, availableWidth / initialViewport.width);
    const viewport = page.getViewport({ scale });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({
      canvasContext: context,
      viewport
    }).promise;

    if (thisRender !== renderNumber) return;

    currentPageNumber = pageNumber;
    $("currentPage").textContent = pageNumber;
    $("currentPageBottom").textContent = pageNumber;
    $("prevPageBtn").disabled = pageNumber <= 1;
    $("prevPageBtnBottom").disabled = pageNumber <= 1;
    $("nextPageBtn").disabled = pageNumber >= pdfDocument.numPages;
    $("nextPageBtnBottom").disabled = pageNumber >= pdfDocument.numPages;

    if (currentBook) {
      currentBook.lastPage = pageNumber;
      currentBook.totalPages = pdfDocument.numPages;
      currentBook.progress = Math.round(
        ((pageNumber - 1) / Math.max(1, pdfDocument.numPages)) * 100
      );

      await saveRecord("books", currentBook);
      renderBooks();
    }
  } catch (error) {
    console.error(error);
    $("readerStatus").textContent = "Could not render this page.";
  }
}

async function startReadingSession() {
  if (!currentBook || !pdfDocument) {
    alert("Open a book before starting a reading session.");
    return;
  }

  if (activeSession) {
    alert("A reading session is already active.");
    return;
  }

  activeSession = {
    id: createId(),
    bookId: currentBook.id,
    bookTitle: currentBook.title,
    startedAt: new Date().toISOString(),
    endedAt: null,
    startPage: currentPageNumber,
    endPage: currentPageNumber,
    durationSeconds: 0
  };

  $("startSessionBtn").disabled = true;
  $("endSessionBtn").disabled = false;
  $("readerStatus").textContent = "Reading session in progress";
  $("sessionMessage").textContent =
    `Started at ${formatDate(activeSession.startedAt)}.`;
}

async function endReadingSession() {
  if (!activeSession) return;

  const endedAt = new Date();
  const startedAt = new Date(activeSession.startedAt);

  activeSession.endedAt = endedAt.toISOString();
  activeSession.endPage = currentPageNumber;
  activeSession.durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
  );

  await saveRecord("history", activeSession);

  const message = `Session saved: ${formatDuration(activeSession.durationSeconds)}.`;

  activeSession = null;
  $("startSessionBtn").disabled = false;
  $("endSessionBtn").disabled = true;
  $("readerStatus").textContent = "Session completed";
  $("sessionMessage").textContent = message;

  await refreshData();
}

function renderHistory() {
  $("emptyHistory").hidden = history.length !== 0;

  $("historyBody").innerHTML = history.map((item) => `
    <tr>
      <td>${escapeHTML(item.bookTitle)}</td>
      <td>${escapeHTML(formatDate(item.startedAt))}</td>
      <td>${escapeHTML(formatDate(item.endedAt))}</td>
      <td>${escapeHTML(formatDuration(item.durationSeconds))}</td>
      <td>${escapeHTML(item.endPage ?? item.startPage ?? "—")}</td>
    </tr>
  `).join("");
}

function recommendationCategory(title) {
  const text = title.toLowerCase();

  if (/mindset|habit|courage|self-help|talk to anyone/.test(text)) {
    return "Personal development";
  }

  if (/human nature|body language|everybody is saying|psychology|thinking, fast/.test(text)) {
    return "Psychology and human behavior";
  }

  if (/sapiens|history|civilization|human history/.test(text)) {
    return "History and society";
  }

  if (/mockingbird|fiction|novel|story/.test(text)) {
    return "Fiction and literature";
  }

  return "General reading";
}

function renderRecommendations() {
  const container = $("recommendations");

  if (books.length === 0) {
    container.innerHTML = `
      <p class="empty-state">
        Add a few books to receive suggestions based on their titles.
      </p>
    `;
    return;
  }

  const categories = {};
  books.forEach((book) => {
    const category = recommendationCategory(book.title);
    categories[category] = (categories[category] || 0) + 1;
  });

  const topCategory = Object.keys(categories).sort(
    (a, b) => categories[b] - categories[a]
  )[0];

  const suggestions = {
    "Personal development": [
      ["Deep Work", "Build focus and improve concentration."],
      ["Atomic Habits", "Explore small changes and routines."]
    ],
    "Psychology and human behavior": [
      ["Influence", "Explore the psychology of persuasion."],
      ["The Social Animal", "Learn about people and social behavior."]
    ],
    "History and society": [
      ["Guns, Germs, and Steel", "Explore factors that shaped societies."],
      ["Factfulness", "Practice looking at world data carefully."]
    ],
    "Fiction and literature": [
      ["1984", "Read a classic dystopian novel."],
      ["To Kill a Mockingbird", "Explore a classic work of literature."]
    ],
    "General reading": [
      ["Factfulness", "Practice questioning assumptions with data."],
      ["Atomic Habits", "Explore practical habit-building ideas."]
    ]
  };

  const items = suggestions[topCategory] || suggestions["General reading"];

  container.innerHTML = items.map(([title, description]) => `
    <article class="recommendation">
      <span>✨</span>
      <div>
        <h3>${escapeHTML(title)}</h3>
        <p>${escapeHTML(description)}</p>
        <p><em>Suggestion based on your library's title categories; not an AI recommendation.</em></p>
      </div>
    </article>
  `).join("");
}

async function renameBook(bookId) {
  const book = books.find((item) => item.id === bookId);
  if (!book) return;

  const newTitle = prompt("Enter a new title:", book.title);
  if (newTitle === null || !newTitle.trim()) return;

  book.title = newTitle.trim();
  await saveRecord("books", book);

  if (currentBook && currentBook.id === book.id) {
    currentBook.title = book.title;
    $("readerTitle").textContent = book.title;
  }

  await refreshData();
}

async function deleteBook(bookId) {
  const book = books.find((item) => item.id === bookId);
  if (!book) return;

  const relatedSession = activeSession && activeSession.bookId === bookId;

  if (relatedSession) {
    alert("End this book's active reading session before deleting it.");
    return;
  }

  const deleteMessage = book.isBundled
    ? `Remove "${book.title}" from your library? The original PDF will stay in the myBooks folder.`
    : `Delete "${book.title}" and its saved PDF from this browser?`;

  if (!confirm(deleteMessage)) {
    return;
  }

  if (currentBook && currentBook.id === bookId) {
    closeReader();
  }

  if (book.isBundled) {
    book.hidden = true;
    await saveRecord("books", book);
  } else {
    await deleteRecord("books", bookId);
  }
  await refreshData();
}

function closeReader() {
  if (activeSession) {
    alert("End the reading session before closing the reader.");
    return;
  }

  currentBook = null;
  pdfDocument = null;
  $("readerSection").hidden = true;
  $("pdfCanvas").getContext("2d").clearRect(
    0, 0, $("pdfCanvas").width, $("pdfCanvas").height
  );
}

async function exportBackup() {
  const backup = {
    app: "My Reading Room",
    exportedAt: new Date().toISOString(),
    books: books.map((book) => ({
      id: book.id,
      title: book.title,
      fileName: book.fileName,
      coverImage: book.coverImage,
      pdfUrl: book.pdfUrl,
      isBundled: book.isBundled,
      lastPage: book.lastPage,
      totalPages: book.totalPages,
      progress: book.progress,
      addedAt: book.addedAt
    })),
    history
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "my-reading-room-backup.json";
  link.click();
  URL.revokeObjectURL(url);

  $("backupMessage").textContent =
    "Backup downloaded. PDF files are not included; keep your originals.";
}

async function importBackup(file) {
  if (!file) return;

  try {
    const backup = JSON.parse(await file.text());

    if (!Array.isArray(backup.books) || !Array.isArray(backup.history)) {
      throw new Error("This file does not look like a Reading Room backup.");
    }

    if (!confirm(
      "Import this backup? Existing records with matching IDs will be updated."
    )) {
      return;
    }

    for (const savedBook of backup.books) {
      const existing = books.find((item) => item.id === savedBook.id);

      // Preserve existing PDF data if a matching book is already in this browser.
      const importedBook = {
        ...savedBook,
        pdfData: existing?.pdfData || null,
        coverImage: savedBook.coverImage || existing?.coverImage || null,
        pdfUrl: savedBook.pdfUrl || existing?.pdfUrl || null,
        isBundled: savedBook.isBundled || existing?.isBundled || false
      };

      await saveRecord("books", importedBook);
    }

    for (const session of backup.history) {
      await saveRecord("history", session);
    }

    await refreshData();

    $("backupMessage").textContent =
      "Backup imported. For books without saved PDF data, click Relink PDF.";
  } catch (error) {
    console.error(error);
    alert("Could not import backup. Please select a valid Reading Room JSON file.");
  }

  $("importInput").value = "";
}

// Interface events
$("addBookBtn").addEventListener("click", () => {
  $("addBookDialog").showModal();
});

$("pdfInput").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    $("bookTitleInput").value = file.name.replace(/\.pdf$/i, "");
  }
});

$("addBookForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const pdfInput = $("pdfInput");
  const coverInput = $("coverImageInput");
  const title = $("bookTitleInput").value.trim();
  if (!pdfInput.files[0] || !title) return;

  const added = await addPDF(pdfInput.files[0], title, coverInput.files[0]);
  if (added) {
    $("addBookDialog").close();
    $("addBookForm").reset();
  }
});

$("cancelAddBookBtn").addEventListener("click", () => {
  $("addBookDialog").close();
  $("addBookForm").reset();
});

$("searchInput").addEventListener("input", renderBooks);

$("bookGrid").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "read") {
    await openBook(id);
  } else if (action === "rename") {
    await renameBook(id);
  } else if (action === "delete") {
    await deleteBook(id);
  } else if (action === "relink") {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "application/pdf";

    picker.addEventListener("change", async () => {
      await relinkPDF(id, picker.files[0]);
    });

    picker.click();
  }
});

$("prevPageBtn").addEventListener("click", async () => {
  if (pdfDocument && currentPageNumber > 1) {
    await renderPage(currentPageNumber - 1);
  }
});

$("nextPageBtn").addEventListener("click", async () => {
  if (pdfDocument && currentPageNumber < pdfDocument.numPages) {
    await renderPage(currentPageNumber + 1);
  }
});

$("prevPageBtnBottom").addEventListener("click", async () => {
  if (pdfDocument && currentPageNumber > 1) {
    await renderPage(currentPageNumber - 1);
  }
});

$("nextPageBtnBottom").addEventListener("click", async () => {
  if (pdfDocument && currentPageNumber < pdfDocument.numPages) {
    await renderPage(currentPageNumber + 1);
  }
});

$("startSessionBtn").addEventListener("click", startReadingSession);
$("endSessionBtn").addEventListener("click", endReadingSession);
$("closeReaderBtn").addEventListener("click", closeReader);
$("exportBtn").addEventListener("click", exportBackup);

$("importInput").addEventListener("change", async (event) => {
  await importBackup(event.target.files[0]);
});

// Save the current page when the user changes books or closes the reader.
// Always click "End session" to save a completed session reliably.
window.addEventListener("beforeunload", () => {
  if (activeSession) {
    // Best effort only. Browsers may stop asynchronous database writes
    // during page closure, so use the End session button first.
    activeSession.endedAt = new Date().toISOString();
    activeSession.endPage = currentPageNumber;
    activeSession.durationSeconds = Math.max(
      0,
      Math.round(
        (new Date(activeSession.endedAt).getTime() -
          new Date(activeSession.startedAt).getTime()) / 1000
      )
    );

    saveRecord("history", activeSession).catch(console.error);
  }
});

async function initialize() {
  try {
    db = await openDatabase();
    $("endSessionBtn").disabled = true;
    const existingBooks = await getAll("books");

    for (const bundledBook of bundledBooks) {
      const id = `bundled:${bundledBook.fileName}`;
      const existingBook = existingBooks.find((book) => book.id === id);

      if (existingBook) {
        if (
          existingBook.title !== bundledBook.title ||
          existingBook.coverImage !== bundledBook.coverImage
        ) {
          existingBook.title = bundledBook.title;
          existingBook.coverImage = bundledBook.coverImage;
          await saveRecord("books", existingBook);
        }
        continue;
      }

      await saveRecord("books", {
        id,
        ...bundledBook,
        pdfUrl: `myBooks/${encodeURIComponent(bundledBook.fileName)}`,
        isBundled: true,
        lastPage: 1,
        totalPages: 0,
        progress: 0,
        addedAt: 0
      });
    }

    await refreshData();
  } catch (error) {
    console.error(error);
    alert("The library could not open. Please use a modern browser with IndexedDB enabled.");
  }
}

initialize();
