/**
 * Sections marked with a "New" badge in the sidebar until the specified date (inclusive).
 * Format: { section_key: 'YYYY-MM-DD' }
 * To add a new label: add an entry. To remove: delete it or let the date pass.
 */
export const NEW_SECTION_EXPIRY: Record<string, string> = {
    prof_societies:      '2026-03-25',
    certificate_courses: '2026-03-25',
    book_chapters:       '2026-03-25',
};
