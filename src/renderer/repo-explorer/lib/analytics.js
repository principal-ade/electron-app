// Google Analytics event tracking utilities
export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID;
// Track page views
export const pageview = (url) => {
    if (!GA_TRACKING_ID || !window.gtag)
        return;
    window.gtag('config', GA_TRACKING_ID, {
        page_path: url,
    });
};
// Track custom events
export const event = ({ action, category, label, value, }) => {
    if (!GA_TRACKING_ID || !window.gtag)
        return;
    window.gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value,
    });
};
// Specialized event trackers
export const trackPageView = (pageName) => {
    event({
        action: 'page_view',
        category: 'Navigation',
        label: pageName,
    });
};
export const trackButtonClick = (buttonName, location) => {
    event({
        action: 'click',
        category: 'Button',
        label: location ? `${buttonName} - ${location}` : buttonName,
    });
};
