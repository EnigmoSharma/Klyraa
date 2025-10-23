// Scroll to top button HTML
const scrollToTopHTML = `
<button id="scroll-to-top" class="fixed bottom-8 right-8 z-50 rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-300 bg-blue-600 text-white" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">
  <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18,15 12,9 6,15"/></svg>
</button>
`;

document.addEventListener('DOMContentLoaded', function() {
    // Insert scroll to top button
    document.body.insertAdjacentHTML('beforeend', scrollToTopHTML);
    
    const button = document.getElementById('scroll-to-top');
    
    function toggleVisibility() {
        if (window.pageYOffset > 300) {
            button.style.display = 'block';
        } else {
            button.style.display = 'none';
        }
    }
    
    window.addEventListener('scroll', toggleVisibility);
    button.style.display = 'none';
});
