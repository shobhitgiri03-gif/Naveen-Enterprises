const menuBtn = document.getElementById("menuBtn");
const mainNav = document.getElementById("mainNav");

menuBtn.addEventListener("click", () => {
    mainNav.classList.toggle("open");
});

document.querySelectorAll("#mainNav a").forEach(link => {
    link.addEventListener("click", () => mainNav.classList.remove("open"));
});

document.getElementById("year").textContent = new Date().getFullYear();

document.getElementById("enquiryForm").addEventListener("submit", function(e) {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const product = document.getElementById("product").value;
    const message = document.getElementById("message").value.trim();

    const text =
        `Hello Naveen Enterprises,%0A%0A` +
        `Name: ${encodeURIComponent(name)}%0A` +
        `Mobile: ${encodeURIComponent(phone)}%0A` +
        `Product: ${encodeURIComponent(product)}%0A` +
        `Requirement: ${encodeURIComponent(message)}`;

    window.open(`https://wa.me/919795027810?text=${text}`, "_blank");
});
