document.addEventListener('DOMContentLoaded', function () {
  const container = document.querySelector('.carousel-container');
  const slides = document.querySelectorAll('.carousel-slide');
  const totalSlides = slides.length;
  const slidesToShow = 3;
  let currentIndex = 0;
  // Clone first and last slides for infinite effect
  const firstSlideClone = slides[0].cloneNode(true);
  const lastSlideClone = slides[totalSlides - 1].cloneNode(true);
  container.appendChild(firstSlideClone);
  container.insertBefore(lastSlideClone, slides[0]);

  function updateCarousel(transition = true) {
    container.style.transition = transition ? 'transform 0.5s ease-in-out' : 'none';
    const slideWidth = 100 / slidesToShow;
    container.style.transform = 'translateX(-${(currentIndex + 1) * slideWidth}%)';
    }

function nextSlide() {
  currentIndex++;
  updateCarousel();

  if (currentIndex >= totalSlides) {
    setTimeout(() => {
      currentIndex = 0;
      updateCarousel(false);
    }, 500);
  }
}

function prevSlide() {
  currentIndex--;
  updateCarousel();

  if (currentIndex < 0) {
    setTimeout(() => {
      currentIndex = totalSlides - 1;
      updateCarousel(false);
    }, 500);
  }
}

document.querySelector('.next').addEventListener('click', nextSlide);
document.querySelector('.prev').addEventListener('click', prevSlide);
// Initial position
updateCarousel(false);
});



document.addEventListener('DOMContentLoaded', () => {
  const modal = document.createElement('div');
  modal.className = 'modal';
  const modalImg = document.createElement('img');
  modalImg.className = 'modal-content';
  modal.appendChild(modalImg);
  document.body.appendChild(modal);

  document.querySelectorAll('.carousel-slide img').forEach(img => {
    img.style.cursor = 'pointer';
    img.onclick = function () {
      modal.style.display = 'block';
      modalImg.src = this.src;
      setTimeout(() => modal.classList.add('show'), 10);
    }
  });

  modal.onclick = function () {
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
  }
});