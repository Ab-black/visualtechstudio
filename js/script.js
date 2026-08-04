document.addEventListener("DOMContentLoaded", function () {

    const track = document.querySelector(".track");
    const cards = document.querySelectorAll(".card");
    const nextBtn = document.querySelector(".next");
    const prevBtn = document.querySelector(".prev");

    let index = 0;
    let autoPlay;

    function updateSlider() {

        const width = track.offsetWidth;

        track.style.transform = `translateX(-${index * width}px)`;

        cards.forEach((card, i) => {
            card.classList.toggle("active", i === index);
        });
    }

    function nextSlide() {
        index = (index + 1) % cards.length;
        updateSlider();
    }

    function prevSlide() {
        index = (index - 1 + cards.length) % cards.length;
        updateSlider();
    }

    nextBtn.addEventListener("click", () => {
        nextSlide();
        restartAuto();
    });

    prevBtn.addEventListener("click", () => {
        prevSlide();
        restartAuto();
    });

    function startAuto() {
        autoPlay = setInterval(nextSlide, 5000);
    }

    function restartAuto() {
        clearInterval(autoPlay);
        startAuto();
    }

    startAuto();
    updateSlider();

    // ======================
    // MOBILE SWIPE SUPPORT
    // ======================
    let startX = 0;

    track.addEventListener("touchstart", e => {
        startX = e.touches[0].clientX;
    });

    track.addEventListener("touchend", e => {
        let endX = e.changedTouches[0].clientX;

        if (startX > endX + 50) nextSlide();
        if (startX < endX - 50) prevSlide();
    });

});
