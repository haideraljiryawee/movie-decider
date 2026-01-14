// Contact Page as Module
import { formatPlatformName } from '../utils/formatters.js';

export function initializeContactPage() {
    // Set active navigation link
    const navLinks = document.querySelectorAll('.nav-links a, .mobile-menu a');
    navLinks.forEach(link => {
        if (link.textContent.includes('Contact') || link.href.includes('/contact')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

export function setupContactForm() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;
    
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            subject: document.getElementById('subject').value,
            message: document.getElementById('message').value
        };
        
        // Basic validation
        if (!formData.name || !formData.email || !formData.subject || !formData.message) {
            alert('Please fill in all required fields.');
            return;
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            alert('Please enter a valid email address.');
            return;
        }
        
        // Submit form
        submitContactForm(formData);
    });
}

function submitContactForm(formData) {
    // Show loading state
    const submitButton = document.querySelector('#contactForm .primary-button');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Sending...';
    submitButton.disabled = true;
    
    // Simulate API call
    setTimeout(() => {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        
        // Show success
        showSuccessMessage(formData);
        document.getElementById('contactForm').reset();
        
        console.log('Form submitted:', formData);
    }, 1500);
}

function showSuccessMessage(formData) {
    // Create or show success message
    let successMsg = document.querySelector('.success-message');
    if (!successMsg) {
        successMsg = document.createElement('div');
        successMsg.className = 'success-message';
        successMsg.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <h3>Message Sent!</h3>
            <p>Thanks ${formData.name}, we'll contact you at ${formData.email}.</p>
        `;
        document.querySelector('.contact-form-container').appendChild(successMsg);
    }
    
    successMsg.classList.add('active');
    setTimeout(() => successMsg.classList.remove('active'), 5000);
}

export function setupFAQ() {
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', function() {
            this.classList.toggle('active');
            const answer = this.nextElementSibling;
            
            if (this.classList.contains('active')) {
                answer.classList.add('active');
                answer.style.maxHeight = answer.scrollHeight + 'px';
            } else {
                answer.classList.remove('active');
                answer.style.maxHeight = 0;
            }
        });
    });
}

// Initialize when imported
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeContactPage();
        setupContactForm();
        setupFAQ();
    });
} else {
    initializeContactPage();
    setupContactForm();
    setupFAQ();
}