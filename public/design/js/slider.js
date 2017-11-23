const btnPrev = document.querySelector('#myCarousel > .left')
const btnNext = document.querySelector('#myCarousel > .right')

btnPrev.addEventListener('click', () => {
    $('#myCarousel').carousel('prev')
})

btnNext.addEventListener('click', () => {
    $('#myCarousel').carousel('next')
})