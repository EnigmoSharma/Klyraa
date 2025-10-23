// Footer HTML template
const footerHTML = `
<footer class="w-full bg-secondary border-t border-gray-300 pt-4">
  <div class="container mx-auto px-4 py-4">
    <div class="grid md:grid-cols-4 gap-4">
      <div class="col-span-2 space-y-2">
        <div class="text-2xl font-bold text-foreground">Klyra</div>
        <p class="text-base text-muted-foreground">Smart Parking, Simplified.</p>
      </div>
      <div class="space-y-2">
        <h3 class="text-base font-semibold text-foreground">Quick Links</h3>
        <nav class="flex flex-col space-y-1">
          <a href="index.html" class="text-muted-foreground hover:text-blue-600 transition-colors">Home</a>
          <a href="aboutUs.html" class="text-muted-foreground hover:text-blue-600 transition-colors">About Us</a>
        </nav>
        
        <div class="pt-2">
          <h3 class="text-base font-semibold text-foreground mb-1">Contact Us</h3>
          <div class="space-y-1">
            <div class="flex items-start">
              <i data-feather="mail" class="w-4 h-4 mt-1 mr-2"></i>
              <a href="mailto:contactUs@klyra.com" class="text-muted-foreground hover:text-blue-600 transition-colors">contactUs@klyra.com</a>
            </div>
            <div class="flex items-start">
              <i data-feather="phone" class="w-4 h-4 mt-1 mr-2"></i>
              <a href="tel:+910123456789" class="text-muted-foreground hover:text-blue-600 transition-colors">+91 01234 56789</a>
            </div>
            <div class="flex items-start">
              <i data-feather="clock" class="w-4 h-4 mt-1 mr-2"></i>
              <div>
                <p class="text-muted-foreground text-sm">Mon-Fri: 9:00 - 18:00</p>
                <p class="text-muted-foreground text-sm">Sat: 10:00 - 15:00</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="space-y-2">
        <h3 class="text-base font-semibold text-foreground">Project Guide</h3>
        <p class="text-muted-foreground">Ajay Dagar</p>
        <div class="pt-2">
          <h4 class="font-medium text-foreground mb-2">Team Members</h4>
          <ul class="space-y-1">
            <li class="text-muted-foreground">
              Vinayak Sharma • <a href="https://www.linkedin.com/in/vinayak-sha/" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">LinkedIn</a> • <a href="https://github.com/EnigmoSharma" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">GitHub</a>
            </li>
            <li class="text-muted-foreground">
              Adwick Akarsh • <a href="https://www.linkedin.com/in/adwickakarsh/" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">LinkedIn</a>
            </li>
            <li class="text-muted-foreground">
              Ispriya Kumari • <a href="https://linkedin.com/in/ispriya-kumari-07b1ba250" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">LinkedIn</a>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <div class="mt-4 pt-3 border-t border-gray-300 text-center text-muted-foreground text-sm">
      © 2025 Klyra. All Rights Reserved.
    </div>
  </div>
</footer>
`;

document.addEventListener('DOMContentLoaded', function() {
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (footerPlaceholder) {
        footerPlaceholder.innerHTML = footerHTML;
        if (window.feather) feather.replace();
    }
});
