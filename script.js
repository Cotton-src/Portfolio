
const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");

const landingScreen = document.getElementById("landingScreen");

function revealPortfolio() {
    landingScreen.classList.add("is-leaving");

    window.setTimeout(() => {
        landingScreen.hidden = true;
        document.getElementById("siteHeader").inert = false;
        document.getElementById("siteMain").inert = false;
        document.getElementById("siteFooter").inert = false;
        document.body.classList.remove("portfolio-locked");
        document.querySelector("#home h1").focus({ preventScroll: true });
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 50 : 600);
}

window.setTimeout(
    revealPortfolio,
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 100 : 3000
);

// Toggle the navigation menu on mobile devices
menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("active");

    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.textContent = isOpen ? "✕" : "☰";
});

// Close the menu after selecting a navigation link
navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
        navLinks.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.textContent = "☰";
    });
});

const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");

function setTheme(theme, persist = false) {
    const isDark = theme === "dark";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    themeToggle.setAttribute("aria-checked", String(isDark)    );
    themeToggle.setAttribute("aria-label", isDark ? "Dark mode" : "Light mode");
    themeIcon.textContent = isDark ? "🌙" : "☀️";

    if (persist) {
        try {
            localStorage.setItem("portfolioTheme", isDark ? "dark" : "light");
        } catch (error) {
            console.error("Could not save the selected theme:", error);
        }
    }
}

let savedTheme = "light";
try {
    savedTheme = localStorage.getItem("portfolioTheme") || "light";
} catch (error) {
    console.error("Could not load the saved theme:", error);
}
setTheme(savedTheme);

themeToggle.addEventListener("click", () => {
    const nextTheme =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(nextTheme, true);

    navLinks.classList.remove("active");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.textContent = "☰";
});

// Automatically display the current year
document.getElementById("year").textContent =
    new Date().getFullYear();

if (
    "IntersectionObserver" in window &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: "0px 0px -35px 0px"
    });

    document.querySelectorAll(
        "main > section, .skill-card, .project-card, .contact-card"
    ).forEach((element) => {
        element.classList.add("reveal-on-scroll");
        revealObserver.observe(element);
    });
}

const achievementDialog = document.getElementById("achievementDialog");
const achievementStorageKey = "portfolioAchievements";
const defaultAchievements = [
    {
        id: "honors-grade-11",
        title: "With Honors — Grade 11",
        description: "Recognized for academic achievement during Grade 11."
    },
    {
        id: "honors-grade-12",
        title: "With Honors — Grade 12",
        description: "Recognized for academic achievement during Grade 12."
    },
    {
        id: "deans-list-first-year-second-semester",
        title: "Dean’s List — First Year, Second Semester",
        description: "Recognized for academic performance during the second semester of my first year."
    }
];
let achievements = defaultAchievements;

try {
    const savedAchievements = localStorage.getItem(achievementStorageKey);
    if (savedAchievements !== null) {
        const parsedAchievements = JSON.parse(savedAchievements);
        if (
            !Array.isArray(parsedAchievements) ||
            !parsedAchievements.every((item) =>
                item &&
                typeof item.id === "string" &&
                typeof item.title === "string" &&
                typeof item.description === "string"
            )
        ) {
            throw new Error("Saved achievements have an invalid format.");
        }
        achievements = parsedAchievements;
    }
} catch (error) {
    console.error("Could not load saved achievements:", error);
    alert("Could not load saved achievements. The default achievements will be shown.");
}

function renderAchievements() {
    const container = document.getElementById("achievementItems");
    container.replaceChildren();

    achievements.forEach((achievement) => {
        const article = document.createElement("article");
        article.className = "achievement-detail";

        let image;
        if (achievement.image) {
            image = document.createElement("img");
            image.src = achievement.image;
            image.alt = `${achievement.title} image`;
        } else {
            image = document.createElement("div");
            image.className = "achievement-image-placeholder";
            image.setAttribute("aria-label", "No image attached");
            image.textContent = "🏆";
        }

        const copy = document.createElement("div");
        copy.className = "achievement-detail-copy";

        const text = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = achievement.title;
        const description = document.createElement("p");
        description.textContent = achievement.description;
        text.append(title, description);

        const deleteButton = document.createElement("button");
        deleteButton.className = "achievement-delete";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute("aria-label", `Delete ${achievement.title}`);
        deleteButton.addEventListener("click", () => {
            const updatedAchievements = achievements.filter(
                (item) => item.id !== achievement.id
            );
            saveAchievements(updatedAchievements);
        });

        copy.append(text, deleteButton);
        article.append(image, copy);
        container.append(article);
    });

    document.getElementById("noAchievementsMessage").hidden =
        achievements.length !== 0;
}

function saveAchievements(updatedAchievements) {
    try {
        localStorage.setItem(
            achievementStorageKey,
            JSON.stringify(updatedAchievements)
        );
        achievements = updatedAchievements;
        renderAchievements();
        return true;
    } catch (error) {
        console.error("Could not save achievements:", error);
        alert("Could not save this achievement. Check your browser storage and try again.");
        return false;
    }
}

renderAchievements();

document.getElementById("openAchievementDialog").addEventListener("click", () => {
    achievementDialog.showModal();
});

document.getElementById("closeAchievementDialog").addEventListener("click", () => {
    achievementDialog.close();
});

achievementDialog.addEventListener("click", (event) => {
    if (event.target === achievementDialog) {
        achievementDialog.close();
    }
});

const achievementForm = document.getElementById("achievementForm");
const achievementTitleInput = document.getElementById("achievementTitleInput");
const achievementDescriptionInput =
    document.getElementById("achievementDescriptionInput");
const achievementImageInput = document.getElementById("achievementImageInput");

function readAchievementImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                resolve(reader.result);
            } else {
                reject(new Error("Could not read the selected achievement image."));
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

document.getElementById("showAchievementForm").addEventListener("click", () => {
    achievementForm.hidden = false;
    achievementTitleInput.focus();
});

document.getElementById("cancelAchievementForm").addEventListener("click", () => {
    achievementForm.reset();
    achievementForm.hidden = true;
});

achievementForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = achievementTitleInput.value.trim();
    const description = achievementDescriptionInput.value.trim();
    if (!title || !description) return;

    const imageFile = achievementImageInput.files[0];
    if (imageFile && !imageFile.type.startsWith("image/")) {
        alert("Please select a valid image file.");
        return;
    }

    if (imageFile && imageFile.size > 1024 * 1024) {
        alert("Please choose an image smaller than 1 MB so it can be saved in this browser.");
        return;
    }

    try {
        const image = imageFile ? await readAchievementImage(imageFile) : null;
        const saved = saveAchievements([
            ...achievements,
            {
                id: crypto.randomUUID(),
                title,
                description,
                image
            }
        ]);

        if (saved) {
            achievementForm.reset();
            achievementForm.hidden = true;
        }
    } catch (error) {
        console.error("Could not read the selected achievement image:", error);
        alert("Could not read the selected image. Please choose another image and try again.");
    }
});
