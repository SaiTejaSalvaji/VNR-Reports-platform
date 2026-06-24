import { Response } from 'express';
import { pool } from '../configs/neonDb.config';
import { logger } from '../utils/logger.utils';
import {
    Document,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    WidthType,
    TextRun,
    AlignmentType,
    ImageRun,
    BorderStyle,
    ShadingType,
    VerticalAlign,
    HeadingLevel,
    PageBreak,
    PageOrientation,
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';

interface ColumnDefinition {
    name: string;
    display_name: string;
    type: string;
    required?: boolean;
    options?: string[];
}

interface SectionMetadata {
    id: number;
    section_key: string;
    display_name: string;
    section_type: 'records' | 'single_value' | 'rich_text' | 'fixed_table';
    columns: ColumnDefinition[];
    fixed_rows?: string[];
    display_order: number;
    config?: any;
}

interface ReportParams {
    monthNum: number;
    yearNum: number;
    departmentIdFilter: number | null;
}

const sendSSE = (res: Response, event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
};


const loadHeaderBanner = (): ArrayBuffer => {
    const bannerPath = path.join(__dirname, '../../public/header_banner.png');
    if (!fs.existsSync(bannerPath)) throw new Error('Header banner file not found');
    const bannerBuffer = fs.readFileSync(bannerPath);
    return bannerBuffer.buffer.slice(bannerBuffer.byteOffset, bannerBuffer.byteOffset + bannerBuffer.byteLength);
};

const fullMonths = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// Green section header background matching the reference snapshot doc (#A8D08D)
const snapshotHeaderShading = { type: ShadingType.CLEAR, color: 'auto', fill: 'A8D08D' };

const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

const cellPadding = { top: 100, bottom: 100, left: 100, right: 100 };

// Parse HTML content (from Tiptap editor) to DOCX elements
const parseHtmlToDocx = (html: string): any[] => {
    if (!html || !html.trim()) return [];

    const children: any[] = [];

    // Simple HTML parser - handles common Tiptap output
    // Remove whitespace between tags
    const cleanHtml = html.replace(/>\s+</g, '><').trim();

    // Split by closing tags to get elements
    const parts = cleanHtml.split(/(<\/?[^>]+>)/g).filter(p => p.trim());

    let currentTextRuns: TextRun[] = [];
    let currentText = '';
    let isBold = false;
    let isItalic = false;
    let isUnderline = false;
    let inTable = false;
    let tableRows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let currentHeading: (typeof HeadingLevel)[keyof typeof HeadingLevel] | null = null;
    let listCounters: number[] = []; // Track ordered list counters for nested lists

    // Flush current text as a text run
    const flushTextRun = () => {
        if (currentText.trim()) {
            const textRunOptions: any = {
                text: currentText,
                font: "Calibri",
                color: "000000"
            };

            if (!currentHeading) {
                textRunOptions.size = 20;
            }
            if (isBold) textRunOptions.bold = true;
            if (isItalic) textRunOptions.italics = true;
            if (isUnderline) textRunOptions.underline = { type: 'single' };

            currentTextRuns.push(new TextRun(textRunOptions));
        }
        currentText = '';
    };

    // Flush paragraph
    const flushParagraph = (heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]) => {
        flushTextRun(); // Flush any remaining text

        if (currentTextRuns.length > 0) {
            const paragraphOptions: any = {
                children: currentTextRuns,
                spacing: { before: heading ? 200 : 50, after: heading ? 100 : 50 }
            };

            if (heading) {
                paragraphOptions.heading = heading;
            }

            children.push(new Paragraph(paragraphOptions));
        }
        currentTextRuns = [];
        currentHeading = null;
    };

    for (const part of parts) {
        if (part.startsWith('<')) {
            const tagMatch = part.match(/<\/?(\w+)/);
            const tag = tagMatch ? tagMatch[1].toLowerCase() : '';
            const isClosing = part.startsWith('</');

            switch (tag) {
                case 'h1':
                    if (!isClosing) {
                        currentHeading = HeadingLevel.HEADING_1;
                    } else {
                        flushParagraph(HeadingLevel.HEADING_1);
                    }
                    break;
                case 'h2':
                    if (!isClosing) {
                        currentHeading = HeadingLevel.HEADING_2;
                    } else {
                        flushParagraph(HeadingLevel.HEADING_2);
                    }
                    break;
                case 'h3':
                    if (!isClosing) {
                        currentHeading = HeadingLevel.HEADING_3;
                    } else {
                        flushParagraph(HeadingLevel.HEADING_3);
                    }
                    break;
                case 'p':
                    if (isClosing) flushParagraph();
                    break;
                case 'strong':
                case 'b':
                    flushTextRun(); // Flush current text before changing formatting
                    isBold = !isClosing;
                    break;
                case 'em':
                case 'i':
                    flushTextRun(); // Flush current text before changing formatting
                    isItalic = !isClosing;
                    break;
                case 'u':
                    flushTextRun(); // Flush current text before changing formatting
                    isUnderline = !isClosing;
                    break;
                case 'ul':
                    // Don't need to track unordered lists, just ignore
                    break;
                case 'ol':
                    if (!isClosing) {
                        // Start a new counter for this ordered list level
                        listCounters.push(0);
                    } else {
                        // Remove counter when list ends
                        listCounters.pop();
                    }
                    break;
                case 'li':
                    if (!isClosing) {
                        // Add bullet or number prefix to the text
                        if (listCounters.length > 0) {
                            // Ordered list - increment and prepend number
                            listCounters[listCounters.length - 1]++;
                            currentText = `${listCounters[listCounters.length - 1]}. `;
                        } else {
                            // Unordered list - prepend bullet
                            currentText = '• ';
                        }
                    } else {
                        // Flush any remaining text that wasn't in a <p> tag
                        if (currentTextRuns.length > 0 || currentText.trim()) {
                            flushParagraph();
                        }
                    }
                    break;
                case 'table':
                    if (!isClosing) {
                        inTable = true;
                        tableRows = [];
                    } else {
                        inTable = false;
                        if (tableRows.length > 0) {
                            children.push(createTableFromHtml(tableRows));
                        }
                    }
                    break;
                case 'tr':
                    if (!isClosing) {
                        currentRow = [];
                    } else {
                        if (currentRow.length > 0) {
                            tableRows.push(currentRow);
                        }
                    }
                    break;
                case 'td':
                case 'th':
                    if (!isClosing) {
                        currentCell = '';
                    } else {
                        currentRow.push(currentCell.trim());
                    }
                    break;
                case 'br':
                    currentText += '\n';
                    break;
            }
        } else {
            // Text content
            const decodedText = part
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"');

            if (inTable) {
                currentCell += decodedText;
            } else {
                currentText += decodedText;
            }
        }
    }

    // Flush any remaining text
    flushParagraph();

    return children;
};

// Create a DOCX table from HTML table data
const createTableFromHtml = (rows: string[][]): Table => {
    const tableRows: TableRow[] = [];

    rows.forEach((cells, rowIndex) => {
        const isHeader = rowIndex === 0;

        tableRows.push(new TableRow({
            children: cells.map(cellText => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({
                        text: cellText,
                        bold: isHeader,
                        font: "Calibri",
                        size: 20
                    })],
                    alignment: AlignmentType.CENTER
                })],
                margins: cellPadding,
                verticalAlign: VerticalAlign.CENTER
            }))
        }));
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
        borders: tableBorders
    });
};

const createVNRHeader = (bannerBuffer: ArrayBuffer): Paragraph => {
    return new Paragraph({
        children: [
            new ImageRun({
                data: bannerBuffer,
                transformation: { width: 650, height: 150 },
                type: "png",
            }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
    });
};

export const reportController = {
    /**
     * Fetch report data for a specific department, month, and year
     */
    async getMonthlyReport(req: any, res: Response): Promise<Response> {
        try {
            const { month, year, department_id } = req.query;
            const userDeptId = req.user?.department_id;
            const role = req.user?.role;

            // For admin, department_id must be explicitly provided
            if (role === 'admin' && !department_id) {
                return res.status(400).json({ error: 'Admin must specify department_id parameter' });
            }

            const targetDeptId = (role === 'admin' && department_id) ? parseInt(department_id as string) : userDeptId;

            if (!targetDeptId || !month || !year) {
                return res.status(400).json({ error: 'Missing required parameters' });
            }

            const result = await pool.query(
                `SELECT * FROM monthly_reports
                 WHERE department_id = $1 AND month = $2 AND year = $3`,
                [targetDeptId, parseInt(month as string), parseInt(year as string)]
            );

            return res.json({
                report: result.rows[0] || { department_id: targetDeptId, month, year, report_data: {} }
            });
        } catch (error) {
            logger.error(`Get monthly report failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    /**
     * Save/Update report data (UPSERT)
     */
    async saveMonthlyReport(req: any, res: Response): Promise<Response> {
        try {
            const { department_id, month, year, report_data } = req.body;
            const userId = req.user?.id;
            const userDeptId = req.user?.department_id;
            const role = req.user?.role;

            if (role !== 'admin' && parseInt(department_id) !== userDeptId) {
                return res.status(403).json({ error: 'Unauthorized to save for this department' });
            }

            const query = `
                INSERT INTO monthly_reports (department_id, month, year, report_data, updated_at)
                VALUES ($1, $2, $3, $4::jsonb, NOW())
                ON CONFLICT (department_id, month, year)
                DO UPDATE SET
                    report_data = EXCLUDED.report_data,
                    updated_at = NOW()
                RETURNING *
            `;

            const result = await pool.query(query, [
                parseInt(department_id),
                parseInt(month),
                parseInt(year),
                JSON.stringify(report_data)
            ]);

            return res.json({
                message: 'Report saved successfully',
                report: result.rows[0]
            });
        } catch (error) {
            logger.error(`Save monthly report failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    /**
     * Generate report with SSE progress updates
     */
    async generateReportWithProgress(req: any, res: Response): Promise<void> {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.flushHeaders();

        let bannerBuffer: ArrayBuffer;

        try {
            const { month, year, department_id } = req.query;
            logger.info(`[REPORT-GEN] Starting report generation: month=${month}, year=${year}, dept=${department_id}`);

            if (!month || !year) {
                logger.error('[REPORT-GEN] Missing month or year');
                sendSSE(res, 'error', { message: 'Month and year are required' });
                res.end();
                return;
            }

            const monthNum = parseInt(month as string);
            const yearNum = parseInt(year as string);
            const targetDeptId = department_id ? parseInt(department_id as string) : null;
            logger.info(`[REPORT-GEN] Parsed params: monthNum=${monthNum}, yearNum=${yearNum}, targetDeptId=${targetDeptId}`);

            sendSSE(res, 'progress', { percentage: 10, message: 'Fetching metadata...' });
            logger.info('[REPORT-GEN] Step 1: Fetching section metadata...');

            // Apply access control filtering based on user role and department
            const userDeptName = req.user?.department_name;
            const userRole = req.user?.role;
            const specialDepts = ['HR', 'MTP', 'ALUMNI', 'ED CELL', 'LIBRARY', 'RDC', 'IQAC'];
            const isSpecialDept = specialDepts.includes(userDeptName);

            // JOIN section_config for this month/year so renderers get config labels
            let sectionsQuery = `
                SELECT sm.*, sc.config
                FROM section_metadata sm
                LEFT JOIN section_config sc
                  ON sc.section_key = sm.section_key
                 AND sc.month = $1
                 AND sc.year  = $2
                WHERE sm.is_active = true`;
            const sectionParams: any[] = [monthNum, yearNum];

            // Filter sections based on access control (same logic as section.controller.ts)
            if (userRole !== 'admin' && targetDeptId) {
                // Only filter when generating department-specific report (not admin institute-wide report)
                if (isSpecialDept) {
                    // Special departments: Show only their specific sections
                    sectionsQuery += ` AND sm.accessible_by @> $3::jsonb`;
                    sectionParams.push(JSON.stringify([`dept:${userDeptName}`]));
                    logger.info(`[REPORT-GEN] Filtering sections for special dept: ${userDeptName}`);
                } else {
                    // Academic departments: Show only academic sections
                    sectionsQuery += ` AND sm.accessible_by @> '["academic"]'::jsonb`;
                    logger.info(`[REPORT-GEN] Filtering sections for academic dept: ${userDeptName}`);
                }
            }

            sectionsQuery += ` ORDER BY display_order ASC`;

            const sectionsResult = await pool.query(sectionsQuery, sectionParams);
            const dbSections: SectionMetadata[] = sectionsResult.rows;
            logger.info(`[REPORT-GEN] Fetched ${dbSections.length} sections from metadata`);

            // Manually inject static sections - ONLY for admin/institute-wide reports
            const staticSections: SectionMetadata[] = [];
            if (!targetDeptId) {
                // Only add IQAC section for complete institute reports (admin)
                staticSections.push({
                    id: 20, section_key: 'iqac_activities', display_name: '19. Internal Quality Assurance Cell (IQAC):',
                    section_type: 'rich_text', columns: [], display_order: 19
                });
                logger.info('[REPORT-GEN] Added IQAC section for institute-wide report');
            }

            // Combine and sort all sections
            const sections = [...dbSections, ...staticSections].sort((a, b) => a.display_order - b.display_order);
            logger.info(`[REPORT-GEN] Total sections after merge: ${sections.length}`);

            logger.info('[REPORT-GEN] Step 2: Fetching departments...');
            const deptsResult = await pool.query(`SELECT id, name FROM departments ORDER BY name ASC`);
            const departments = deptsResult.rows;
            const deptMap = new Map(departments.map(d => [d.id, d.name]));
            logger.info(`[REPORT-GEN] Fetched ${departments.length} departments`);

            // Filter department map if specific department is requested
            const filteredDeptMap = targetDeptId
                ? new Map([[targetDeptId, deptMap.get(targetDeptId) || "Unknown Department"]])
                : deptMap;  // No filter = all departments (preserves current behavior)

            logger.info(`[REPORT-GEN] Report scope: ${filteredDeptMap.size} department(s)`);

            sendSSE(res, 'progress', { percentage: 20, message: 'Fetching report data...' });
            logger.info('[REPORT-GEN] Step 3: Fetching report data...');
            let reportQuery = `SELECT * FROM monthly_reports WHERE month = $1 AND year = $2`;
            const reportParams = [monthNum, yearNum];
            if (targetDeptId) {
                reportQuery += ` AND department_id = $3`;
                reportParams.push(targetDeptId);
            }
            logger.info(`[REPORT-GEN] Report query: ${reportQuery}, params: ${JSON.stringify(reportParams)}`);
            const reportsResult = await pool.query(reportQuery, reportParams);
            const reports = reportsResult.rows;
            logger.info(`[REPORT-GEN] Fetched ${reports.length} reports`);

            // 3. Load Logo
            sendSSE(res, 'progress', { percentage: 30, message: 'Loading resources...' });
            logger.info('[REPORT-GEN] Step 4: Loading header banner...');
            try {
                bannerBuffer = loadHeaderBanner();
                logger.info('[REPORT-GEN] Banner loaded successfully');
            } catch (err) {
                logger.error(`[REPORT-GEN] Failed to load banner: ${(err as Error).message}`);
                sendSSE(res, 'error', { message: 'Failed to load header banner' });
                res.end();
                return;
            }

            // 4. Generate Document

            sendSSE(res, 'progress', { percentage: 40, message: 'Generating document...' });
            logger.info('[REPORT-GEN] Step 5: Starting document generation...');
            const departmentName = targetDeptId ? (deptMap.get(targetDeptId) || "Department") : "INSTITUTE";
            logger.info(`[REPORT-GEN] Generating report for: ${departmentName}`);

            // Split sections into portrait and landscape groups
            logger.info('[REPORT-GEN] Step 6: Splitting sections by orientation...');
            const sectionsBeforeLandscape = sections.filter(s =>
                s.section_key !== 'conference_papers' && s.section_key !== 'journal_publications'
            ).filter(s => s.display_order < 4);

            const landscapeSections = sections.filter(s =>
                s.section_key === 'conference_papers' || s.section_key === 'journal_publications'
            );

            const sectionsAfterLandscape = sections.filter(s =>
                s.section_key !== 'conference_papers' && s.section_key !== 'journal_publications'
            ).filter(s => s.display_order > 5);

            logger.info(`[REPORT-GEN] Sections before landscape: ${sectionsBeforeLandscape.length}`);
            logger.info(`[REPORT-GEN] Landscape sections: ${landscapeSections.length}`);
            logger.info(`[REPORT-GEN] Sections after landscape: ${sectionsAfterLandscape.length}`);

            logger.info('[REPORT-GEN] Step 7: Rendering all sections...');

            // Render all sections (pass year for MTP section)
            const renderedBeforeLandscape = this.renderSections(sectionsBeforeLandscape, reports, filteredDeptMap, yearNum);
            const renderedLandscape = this.renderSections(landscapeSections, reports, filteredDeptMap, yearNum);
            const renderedAfterLandscape = this.renderSections(sectionsAfterLandscape, reports, filteredDeptMap, yearNum);

            logger.info('[REPORT-GEN] Step 8: Creating DOCX document structure...');

            // Build document sections dynamically - only include sections with content
            const documentSections: any[] = [];

            // Section 1: Portrait (Header + Title + Early Sections)
            // Always include this section (has header and title)
            const firstSectionChildren = [
                createVNRHeader(bannerBuffer),
                new Paragraph({ children: [], spacing: { after: 400 } }),
                this.createReportTitle(monthNum, yearNum),
                new Paragraph({ children: [], spacing: { after: 400 } }),
                ...renderedBeforeLandscape
            ];

            // If there are sections after landscape, add them to first section, otherwise this is the only section
            if (renderedLandscape.length === 0 && renderedAfterLandscape.length > 0) {
                // No landscape sections, add all portrait content to first section
                firstSectionChildren.push(...renderedAfterLandscape);
            }

            documentSections.push({
                properties: {
                    page: {
                        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
                    }
                },
                children: firstSectionChildren
            });

            // Section 2: Landscape (only if has content)
            if (renderedLandscape.length > 0) {
                logger.info('[REPORT-GEN] Adding landscape section');
                documentSections.push({
                    properties: {
                        page: {
                            size: { orientation: PageOrientation.LANDSCAPE },
                            margin: { top: 720, right: 720, bottom: 720, left: 720 }
                        }
                    },
                    children: renderedLandscape
                });

                // Section 3: Portrait after landscape (only if landscape exists)
                if (renderedAfterLandscape.length > 0) {
                    logger.info('[REPORT-GEN] Adding portrait section after landscape');
                    documentSections.push({
                        properties: {
                            page: {
                                margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
                            }
                        },
                        children: renderedAfterLandscape
                    });
                }
            }

            logger.info(`[REPORT-GEN] Document has ${documentSections.length} section(s)`);

            const doc = new Document({
                styles: {
                    paragraphStyles: [
                        {
                            id: "Heading1",
                            name: "Heading 1",
                            basedOn: "Normal",
                            next: "Normal",
                            quickFormat: true,
                            run: {
                                font: "Calibri",
                                bold: true,
                                size: 32, // 16pt
                            },
                            paragraph: {
                                spacing: { before: 240, after: 120 },
                                outlineLevel: 0,
                            },
                        },
                        {
                            id: "Heading2",
                            name: "Heading 2",
                            basedOn: "Normal",
                            next: "Normal",
                            quickFormat: true,
                            run: {
                                font: "Calibri",
                                bold: true,
                                size: 28, // 14pt
                            },
                            paragraph: {
                                spacing: { before: 200, after: 100 },
                                outlineLevel: 1,
                            },
                        },
                        {
                            id: "Heading3",
                            name: "Heading 3",
                            basedOn: "Normal",
                            next: "Normal",
                            quickFormat: true,
                            run: {
                                font: "Calibri",
                                bold: true,
                                size: 26, // 13pt
                            },
                            paragraph: {
                                spacing: { before: 200, after: 100 },
                                outlineLevel: 2,
                            },
                        },
                    ],
                },
                sections: documentSections
            });
            logger.info('[REPORT-GEN] Document structure created successfully');

            sendSSE(res, 'progress', { percentage: 90, message: 'Finalizing file...' });
            logger.info('[REPORT-GEN] Step 9: Converting to buffer...');
            const buffer = await Packer.toBuffer(doc);
            logger.info(`[REPORT-GEN] Buffer created, size: ${buffer.length} bytes`);

            const fileName = targetDeptId
                ? `Monthly_report of ${fullMonths[monthNum - 1]} ${yearNum} - ${deptMap.get(targetDeptId) || 'Department'}.docx`
                : `Monthly_report of ${fullMonths[monthNum - 1]} ${yearNum}.docx`;
            logger.info(`[REPORT-GEN] Step 10: Sending file to client: ${fileName}`);
            sendSSE(res, 'complete', {
                data: buffer.toString('base64'),
                fileName,
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            logger.info('[REPORT-GEN] Report generation completed successfully');
            res.end();

        } catch (error) {
            logger.error(`[REPORT-GEN] ERROR: ${(error as Error).message}`);
            logger.error(`[REPORT-GEN] Stack trace: ${(error as Error).stack}`);
            sendSSE(res, 'error', { message: 'Report generation failed' });
            res.end();
        }
    },

    createReportTitle(month: number, year: number): Paragraph {
        const monthName = fullMonths[month - 1] || "Unknown";
        return new Paragraph({
            children: [
                new TextRun({
                    text: `Report on the events that took place in the Institute during `,
                    font: "Calibri",
                    size: 24,
                    bold: true,
                    underline: { type: "single", color: "000000" },
                }),
                new TextRun({
                    text: `${monthName.toUpperCase()}, ${year}`,
                    font: "Calibri",
                    size: 24,
                    bold: true,
                    underline: { type: "single", color: "000000" },
                }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
        });
    },

    renderSections(sections: SectionMetadata[], reports: any[], deptMap: Map<number, string>, year?: number): any[] {
        const children: any[] = [];

        sections.forEach((section, idx) => {
            logger.info(`[REPORT-GEN] Rendering section ${idx + 1}/${sections.length}: ${section.section_key} (${section.display_name})`);
            const renderer = (this as any)[`render_${section.section_key}`];

            let sectionChildren: any[] = [];
            try {
                if (typeof renderer === 'function') {
                    sectionChildren = renderer.call(this, section, reports, deptMap, year);
                } else {
                    sectionChildren = this.renderSingleSection(section, reports, deptMap);
                }
                logger.info(`[REPORT-GEN] Section ${section.section_key} rendered successfully, generated ${sectionChildren.length} elements`);
            } catch (err) {
                logger.error(`[REPORT-GEN] ERROR rendering section ${section.section_key}: ${(err as Error).message}`);
                throw err;
            }

            if (sectionChildren && sectionChildren.length > 0) {
                children.push(...sectionChildren);
                children.push(new Paragraph({ children: [], spacing: { before: 400, after: 400 } }));
            }
        });

        logger.info(`[REPORT-GEN] All sections rendered, total children: ${children.length}`);
        return children;
    },

    render_faculty_details(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number) {
        // Skip Faculty Details table for department-specific reports (when filtered to single department)
        if (deptMap.size === 1) {
            logger.info('[REPORT-GEN] Skipping Faculty Details section for department-specific report');
            return [];
        }
        return [this.renderSingleValueTable(section, reports)];
    },

    render_events_conducted(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number) {
        return [this.renderSummaryCountTable(section, reports, deptMap)];
    },

    render_faculty_sponsored(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number) {
        return [this.renderSummaryCountTable(section, reports, deptMap)];
    },

    render_conference_papers(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number) {
        return [this.renderRecordsTable(section, reports, deptMap)];
    },

    render_journal_publications(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number) {
        return [this.renderRecordsTable(section, reports, deptMap)];
    },

    render_dept_achievements(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number, isSnapshot = false) {
        return [this.renderRecordsTable(section, reports, deptMap, isSnapshot)];
    },

    render_faculty_achievements(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number, isSnapshot = false) {
        return [this.renderRecordsTable(section, reports, deptMap, isSnapshot)];
    },

    render_student_achievements(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number, isSnapshot = false) {
        return [this.renderRecordsTable(section, reports, deptMap, isSnapshot)];
    },

    render_guest_lectures(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number) {
        return [this.renderRecordsTable(section, reports, deptMap)];
    },

    render_students_sponsored(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number) {
        return [this.renderRecordsTable(section, reports, deptMap)];
    },

    render_events_organized(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number) {
        return [this.renderRecordsTable(section, reports, deptMap)];
    },

    render_hackathons_organized(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number) {
        return [this.renderRecordsTable(section, reports, deptMap)];
    },

    render_industrial_visits(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number) {
        return [this.renderRecordsTable(section, reports, deptMap)];
    },

    render_project_proposals(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number, isSnapshot = false) {
        return [this.renderRecordsTableWithTotal(section, reports, deptMap, 'amount_approved', isSnapshot)];
    },

    render_consultancy_projects(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number) {
        return [this.renderConsultancyProjectsTable(section, reports, deptMap)];
    },

    render_patents(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number, isSnapshot = false) {
        return [this.renderRecordsTable(section, reports, deptMap, isSnapshot)];
    },

    render_library_info(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number, isSnapshot = false) {
        return [this.renderLibraryInfoTable(section, reports, isSnapshot)];
    },

    render_mtp_activities(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number) {
        const elements: any[] = [];

        // Add the section display name
        elements.push(new Paragraph({
            children: [
                new TextRun({
                    text: section.display_name,
                    font: "Calibri",
                    size: 22,
                    bold: true,
                    color: "006600"
                })
            ],
            spacing: { before: 200, after: 200 }
        }));

        // Add "Placement Activities for batch YYYY:" header
        const batchYear = year || new Date().getFullYear();
        elements.push(new Paragraph({
            children: [
                new TextRun({
                    text: `Placement Activities for batch ${batchYear}:`,
                    font: "Calibri",
                    size: 24,
                    bold: true,
                    color: "000000"
                })
            ],
            spacing: { before: 200, after: 200 }
        }));

        // Calculate summary statistics
        const fixedDepts = section.fixed_rows || [];
        let data: Record<string, any> = {};
        let highlights = '';

        reports.forEach(r => {
            const records = r.report_data[section.section_key];
            if (Array.isArray(records)) {
                records.forEach((rec: any) => {
                    if (rec.dept) {
                        data[rec.dept] = rec;
                    }
                    // Get highlights from the first record that has it
                    if (rec.highlights && !highlights) {
                        highlights = rec.highlights;
                    }
                });
            }
        });

        let totalEligible = 0;
        let totalPlaced = 0;
        let totalOffers = 0;
        let studentsAbove10L = 0;
        let studentsBetween6_10L = 0;
        let highestPackage = 0;
        let lowestPackage = Infinity;
        let totalSalary = 0;
        let cseITAlliedSalary = 0;
        let cseITAlliedCount = 0;
        const packages: number[] = [];

        const cseITAlliedDepts = ['CSE', 'CSBS', 'AIML', 'IOT', 'DS', 'CYS', 'AI & DS', 'AI&DS', 'IT'];

        fixedDepts.forEach((dept: string) => {
            const deptData = data[dept] || {};
            const eligible = parseFloat(deptData.eligible) || 0;
            const placed = parseFloat(deptData.placed) || 0;
            const offers = parseFloat(deptData.offers) || 0;
            const avgPackage = parseFloat(deptData.avg_package) || 0;

            totalEligible += eligible;
            totalPlaced += placed;
            totalOffers += offers;

            if (placed > 0 && avgPackage > 0) {
                packages.push(avgPackage);
                totalSalary += avgPackage * placed;

                // Check if CSE/IT Allied department
                if (cseITAlliedDepts.includes(dept)) {
                    cseITAlliedSalary += avgPackage * placed;
                    cseITAlliedCount += placed;
                }

                // Count students by package range
                if (avgPackage > 10) {
                    studentsAbove10L += placed;
                } else if (avgPackage >= 6 && avgPackage <= 10) {
                    studentsBetween6_10L += placed;
                }

                // Track highest and lowest
                if (avgPackage > highestPackage) {
                    highestPackage = avgPackage;
                }
                if (avgPackage < lowestPackage) {
                    lowestPackage = avgPackage;
                }
            }
        });

        const avgSalary = totalPlaced > 0 ? totalSalary / totalPlaced : 0;
        const cseITAvgSalary = cseITAlliedCount > 0 ? cseITAlliedSalary / cseITAlliedCount : 0;

        // Calculate median
        packages.sort((a, b) => a - b);
        const median = packages.length > 0
            ? packages.length % 2 === 0
                ? (packages[packages.length / 2 - 1] + packages[packages.length / 2]) / 2
                : packages[Math.floor(packages.length / 2)]
            : 0;

        // Inject calculated percentage column as 2nd last (before avg_package)
        const sectionWithCalcCol = {
            ...section,
            columns: [...section.columns.slice(0, -1), { name: '__calc_percentage', display_name: 'Percentage (%) (D/C)', type: 'CALCULATED' }, ...section.columns.slice(-1)]
        };

        // Build summary statistics rows
        const summaryRows: TableRow[] = [];
        // Must match renderFixedDepartmentTable which filters out SINGLE_TEXTAREA columns
        const totalColumns = 2 + sectionWithCalcCol.columns.filter((c: any) => c.type !== 'SINGLE_TEXTAREA').length;

        // Helper function to create a summary row with label and value
        const createSummaryRow = (label: string, value: string) => {
            return new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: label, font: "Calibri", size: 20 })],
                            alignment: AlignmentType.LEFT
                        })],
                        margins: cellPadding,
                        columnSpan: totalColumns - 1
                    }),
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: value, font: "Calibri", size: 20 })],
                            alignment: AlignmentType.CENTER
                        })],
                        margins: cellPadding
                    })
                ]
            });
        };

        // Add summary statistics rows
        summaryRows.push(createSummaryRow("Eligible Students", String(totalEligible)));
        summaryRows.push(createSummaryRow("No. of Students Placed", String(totalPlaced)));
        summaryRows.push(createSummaryRow("Total Offers", String(totalOffers)));

        // Add highlights row if data exists
        if (highlights) {
            // Split highlights by newlines and create paragraphs for each line
            const highlightLines = highlights.split('\n').filter(line => line.trim() !== '');
            const highlightParagraphs = highlightLines.map(line =>
                new Paragraph({
                    children: [new TextRun({ text: line.trim(), font: "Calibri", size: 20 })],
                    alignment: AlignmentType.LEFT,
                    spacing: { after: 100 }
                })
            );

            summaryRows.push(new TableRow({
                children: [
                    new TableCell({
                        children: highlightParagraphs,
                        margins: cellPadding,
                        columnSpan: totalColumns
                    })
                ]
            }));
        }

        // Add the placement activities table with summary rows attached
        elements.push(this.renderFixedDepartmentTable(sectionWithCalcCol, reports, summaryRows));

        return elements;
    },

    render_iqac_activities(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number) {
        return [this.renderFixedSection(section)];
    },

    render_alumni_activities(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number, isSnapshot = false) {
        // All rich_text sections now use HTML/Tiptap editor
        return this.renderHtmlSection(section, reports, deptMap, false, isSnapshot);
    },

    render_ed_cell_activities(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number) {
        // All rich_text sections now use HTML/Tiptap editor
        return this.renderHtmlSection(section, reports, deptMap);
    },

    render_rdc_activities(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, year?: number) {
        // All rich_text sections now use HTML/Tiptap editor
        return this.renderHtmlSection(section, reports, deptMap);
    },

    renderFixedSection(section: SectionMetadata): Table {
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: section.display_name, bold: true, color: "006600", font: "Calibri", size: 22 }),
                                        new TextRun({ text: " Attached.", font: "Calibri", size: 22 })
                                    ],
                                    spacing: { before: 100, after: 100 }
                                })
                            ],
                            margins: { top: 100, bottom: 100, left: 100, right: 100 }
                        })
                    ]
                })
            ]
        });
    },

    renderFixedDepartmentTable(section: any, reports: any[], additionalRows: TableRow[] = []): Table {
        const fixedDepts = section.fixed_rows || [];
        // Filter out SINGLE_TEXTAREA columns — rendered separately, not per-row in the table
        const tableColumns: ColumnDefinition[] = (section.columns || []).filter((col: ColumnDefinition) => col.type !== 'SINGLE_TEXTAREA');

        // Aggregate data from MTP report
        let data: Record<string, any> = {};
        reports.forEach(r => {
            const records = r.report_data[section.section_key];
            if (Array.isArray(records)) {
                records.forEach((rec: any) => {
                    if (rec.dept) {
                        data[rec.dept] = rec;
                    }
                });
            }
        });

        // Header row with column names
        const headerCells = [
            new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: "Sl. No.", bold: true, color: "c00000", font: "Calibri", size: 20 })],
                    alignment: AlignmentType.CENTER
                })],
                margins: cellPadding
            }),
            new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: "Dept.", bold: true, color: "c00000", font: "Calibri", size: 20 })],
                    alignment: AlignmentType.CENTER
                })],
                margins: cellPadding
            }),
            ...tableColumns.map((col: any) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: col.display_name, bold: true, color: "c00000", font: "Calibri", size: 20 })],
                    alignment: AlignmentType.CENTER
                })],
                margins: cellPadding
            }))
        ];

        const rows = [
            new TableRow({ children: headerCells })
        ];

        // Data rows for each fixed department
        fixedDepts.forEach((dept: string, idx: number) => {
            const deptData = data[dept] || {};

            rows.push(new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: String(idx + 1), font: "Calibri", size: 20 })],
                            alignment: AlignmentType.CENTER
                        })],
                        margins: cellPadding
                    }),
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: dept, font: "Calibri", size: 20 })],
                            alignment: AlignmentType.LEFT
                        })],
                        margins: cellPadding
                    }),
                    ...tableColumns.map((col: any) => {
                        let cellText: string;
                        if (col.name === '__calc_percentage') {
                            const placed = parseFloat(deptData.placed) || 0;
                            const eligible = parseFloat(deptData.eligible) || 0;
                            cellText = eligible > 0 ? ((placed / eligible) * 100).toFixed(2) + '%' : '--';
                        } else {
                            cellText = deptData[col.name] !== undefined && deptData[col.name] !== null && deptData[col.name] !== ''
                                ? String(deptData[col.name])
                                : '--';
                        }
                        return new TableCell({
                            children: [new Paragraph({
                                children: [new TextRun({ text: cellText, font: "Calibri", size: 20 })],
                                alignment: AlignmentType.CENTER
                            })],
                            margins: cellPadding
                        });
                    })
                ]
            }));
        });

        // Calculate and add TOTAL row
        const totals: Record<string, number> = {};
        tableColumns.forEach((col: any) => {
            let sum = 0;
            fixedDepts.forEach((dept: string) => {
                const deptData = data[dept] || {};
                const val = parseFloat(deptData[col.name]);
                if (!isNaN(val)) sum += val;
            });
            totals[col.name] = sum;
        });

        rows.push(new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [] })], margins: cellPadding }),
                new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: "TOTAL", bold: true, font: "Calibri", size: 20 })],
                        alignment: AlignmentType.LEFT
                    })],
                    margins: cellPadding
                }),
                ...tableColumns.map((col: any) => {
                    let text: string;
                    if (col.name === '__calc_percentage') {
                        let totalPlacedSum = 0, totalEligibleSum = 0;
                        fixedDepts.forEach((dept: string) => {
                            const d = data[dept] || {};
                            totalPlacedSum += parseFloat(d.placed) || 0;
                            totalEligibleSum += parseFloat(d.eligible) || 0;
                        });
                        text = totalEligibleSum > 0 ? ((totalPlacedSum / totalEligibleSum) * 100).toFixed(2) + '%' : '--';
                    } else if (col.name === 'avg_package') {
                        text = '--';
                    } else {
                        text = totals[col.name] ? String(totals[col.name]) : '--';
                    }
                    return new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text, font: "Calibri", size: 20, bold: true })],
                            alignment: AlignmentType.CENTER
                        })],
                        margins: cellPadding
                    });
                })
            ]
        }));

        // Append additional summary rows if provided
        if (additionalRows.length > 0) {
            rows.push(...additionalRows);
        }

        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows,
            borders: tableBorders
        });
    },

    renderSummaryCountTable(section: SectionMetadata, reports: any[], deptMap: Map<number, string>): Table {
        const optionKeys = section.columns.find(c => c.type === 'SELECT')?.options || [];
        const dataMap = new Map<number, Record<string, number>>();

        reports.forEach(r => {
            const records = r.report_data[section.section_key];
            if (Array.isArray(records)) {
                const counts: Record<string, number> = {};
                records.forEach(rec => {
                    const type = rec.event_type;
                    counts[type] = (counts[type] || 0) + 1;
                });
                dataMap.set(r.department_id, counts);
            }
        });

        // Departments to exclude from tables 2 and 3
        const excludedDepartments = ['ADMIN', 'HR', 'ED CELL', 'LIBRARY', 'MTP', 'RDC', 'TEST', 'ALUMNI'];

        // Define the specific order for departments (exact match with DB names)
        const departmentOrder = [
            'CE',
            'EEE',
            'ME',
            'ECE',
            'CSE',
            'EIE',
            'IT',
            'AE',
            'CSE (AIML & IoT)',
            'CSE (CS, DS) AI&DS',
            'Physics',
            'Chemistry',
            'English',
            'M&MS',
            'BIOTECH'];

        // Get ALL departments, filter out excluded ones, and sort by defined order
        const allDeptIds = Array.from(deptMap.keys())
            .filter(deptId => {
                const deptName = (deptMap.get(deptId) || "").toUpperCase();
                return !excludedDepartments.some(excluded => deptName.toUpperCase() === excluded.toUpperCase());
            })
            .sort((a, b) => {
                const nameA = deptMap.get(a) || "";
                const nameB = deptMap.get(b) || "";

                // Find exact indices in the defined order
                const indexA = departmentOrder.findIndex(dept => dept === nameA);
                const indexB = departmentOrder.findIndex(dept => dept === nameB);

                // If both found in order, sort by order
                if (indexA !== -1 && indexB !== -1) {
                    return indexA - indexB;
                }
                // If only one found, prioritize it
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                // If neither found, sort alphabetically
                return nameA.localeCompare(nameB);
            });

        const headerCells = [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "S. No.", bold: true, font: "Calibri", size: 20 })] })], margins: cellPadding }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Dept.", bold: true, font: "Calibri", size: 20 })] })], margins: cellPadding }),
            ...optionKeys.map(opt => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: opt, bold: true, font: "Calibri", size: 20 })], alignment: AlignmentType.CENTER })],
                margins: cellPadding
            }))
        ];

        const rows = [
            new TableRow({
                children: [new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: section.display_name, bold: true, color: "006600", font: "Calibri", size: 22 })] })],
                    columnSpan: optionKeys.length + 2
                })]
            }),
            new TableRow({ children: headerCells })
        ];

        // Render rows for ALL departments, not just those with data
        allDeptIds.forEach((deptId, idx) => {
            const counts = dataMap.get(deptId) || {}; // Empty object if no data
            rows.push(new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1), font: "Calibri", size: 20 })] })], margins: cellPadding }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: deptMap.get(deptId) || "", font: "Calibri", size: 20 })] })], margins: cellPadding }),
                    ...optionKeys.map(opt => new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: counts[opt] ? String(counts[opt]) : "-", font: "Calibri", size: 20 })], alignment: AlignmentType.CENTER })],
                        margins: cellPadding
                    }))
                ]
            }));
        });

        const totals: Record<string, number> = {};
        dataMap.forEach(counts => {
            optionKeys.forEach(opt => totals[opt] = (totals[opt] || 0) + (counts[opt] || 0));
        });

        rows.push(new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [] })], margins: cellPadding }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Total", bold: true, font: "Calibri", size: 20 })], alignment: AlignmentType.RIGHT })], margins: cellPadding }),
                ...optionKeys.map(opt => new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: totals[opt] ? String(totals[opt]) : "-", bold: true, font: "Calibri", size: 20 })], alignment: AlignmentType.CENTER })],
                    margins: cellPadding
                }))
            ]
        }));

        return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, borders: tableBorders });
    },

    renderSingleSection(section: SectionMetadata, reports: any[], deptMap: Map<number, string>): any[] {
        switch (section.section_type) {
            case 'single_value': return [this.renderSingleValueTable(section, reports)];
            case 'records': return [this.renderRecordsTable(section, reports, deptMap)];
            case 'rich_text': return this.renderHtmlSection(section, reports, deptMap);
            default: return [];
        }
    },

    renderSingleValueTable(section: SectionMetadata, reports: any[]): Table {
        const aggregated: Record<string, any> = {};
        section.columns.forEach(col => {
            let total = 0;
            let isNumeric = col.type === 'NUMBER';
            reports.forEach(r => {
                const val = r.report_data[section.section_key]?.[col.name];
                if (isNumeric && val) total += parseFloat(val);
                else if (!isNumeric && val) aggregated[col.name] = val;
            });
            if (isNumeric) aggregated[col.name] = total ?? '--'; // Use nullish coalescing to preserve 0
        });

        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [
                new TableRow({
                    children: [new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: section.display_name, bold: true, color: "006600", font: "Calibri", size: 22 })],
                            alignment: AlignmentType.LEFT
                        })],
                        columnSpan: section.columns.length,
                        borders: { bottom: { style: BorderStyle.SINGLE, size: 1 } }
                    })]
                }),
                new TableRow({
                    children: section.columns.map(col => new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: col.display_name, bold: true, size: 18, color: "0000cc", font: "Calibri" })],
                            alignment: AlignmentType.CENTER
                        })],
                        margins: cellPadding,
                        verticalAlign: VerticalAlign.CENTER
                    }))
                }),
                new TableRow({
                    children: section.columns.map(col => new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({
                                text: aggregated[col.name] !== undefined && aggregated[col.name] !== null && aggregated[col.name] !== ''
                                    ? String(aggregated[col.name])
                                    : '--',
                                font: "Calibri",
                                size: 18
                            })],
                            alignment: AlignmentType.CENTER
                        })],
                        margins: cellPadding
                    }))
                })
            ]
        });
    },

    renderLibraryInfoTable(section: SectionMetadata, reports: any[], useGreenHeader = false): Table {
        const aggregated: Record<string, any> = {};
        section.columns.forEach(col => {
            let total = 0;
            let isNumeric = col.type === 'NUMBER';
            reports.forEach(r => {
                const val = r.report_data[section.section_key]?.[col.name];
                if (isNumeric && val) total += parseFloat(val);
                else if (!isNumeric && val) aggregated[col.name] = val;
            });
            if (isNumeric) aggregated[col.name] = total ?? '--';
        });

        const rows = [
            new TableRow({
                children: [new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: section.display_name, bold: true, color: "006600", font: "Calibri", size: 22 })],
                        alignment: AlignmentType.LEFT
                    })],
                    columnSpan: 3,
                    borders: { bottom: { style: BorderStyle.SINGLE, size: 1 } },
                    ...(useGreenHeader ? { shading: snapshotHeaderShading, margins: cellPadding } : {})
                })]
            })
        ];

        section.columns.forEach((col, index) => {
            rows.push(new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: String(index + 1), font: "Calibri", size: 20 })],
                            alignment: AlignmentType.CENTER
                        })],
                        margins: cellPadding,
                        width: { size: 5, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: col.display_name, font: "Calibri", size: 20 })],
                            alignment: AlignmentType.LEFT
                        })],
                        margins: cellPadding,
                        width: { size: 70, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({
                                text: aggregated[col.name] !== undefined && aggregated[col.name] !== null && aggregated[col.name] !== ''
                                    ? String(aggregated[col.name])
                                    : '--',
                                font: "Calibri",
                                size: 20,
                                bold: true
                            })],
                            alignment: AlignmentType.CENTER
                        })],
                        margins: cellPadding,
                        width: { size: 25, type: WidthType.PERCENTAGE }
                    })
                ]
            }));
        });

        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows
        });
    },

    renderRecordsTable(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, useGreenHeader = false): Table {
        const allRecords: any[] = [];
        reports.forEach(r => {
            const records = r.report_data[section.section_key];
            if (Array.isArray(records)) {
                records.forEach(rec => allRecords.push({ ...rec, _dept: deptMap.get(r.department_id) }));
            }
        });

        const hasData = allRecords.length > 0;

        const headerCells = [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "S.No", bold: true, color: "c00000", font: "Calibri", size: 20 })] })], margins: cellPadding }),
            ...section.columns.map(col => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: col.display_name, bold: true, color: "c00000", font: "Calibri", size: 20 })] })],
                margins: cellPadding
            }))
        ];

        const rows = [
            new TableRow({
                children: [new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: section.display_name, bold: true, color: "006600", font: "Calibri", size: 22 })] })],
                    columnSpan: section.columns.length + 1,
                    ...(useGreenHeader ? { shading: snapshotHeaderShading, margins: cellPadding } : {})
                })]
            }),
            new TableRow({ children: headerCells })
        ];

        if (!hasData) {
            rows.push(new TableRow({
                children: [new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "No data available", italics: true, font: "Calibri", size: 20 })], alignment: AlignmentType.CENTER })],
                    columnSpan: section.columns.length + 1
                })]
            }));
        } else {
            allRecords.forEach((rec, i) => {
                rows.push(new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), font: "Calibri", size: 20 })] })], margins: cellPadding }),
                        ...section.columns.map(col => new TableCell({
                            children: [new Paragraph({
                                children: [new TextRun({
                                    text: rec[col.name] !== undefined && rec[col.name] !== null && rec[col.name] !== ''
                                        ? String(rec[col.name])
                                        : '--',
                                    font: "Calibri",
                                    size: 20
                                })]
                            })],
                            margins: cellPadding
                        }))
                    ]
                }));
            });
        }

        return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, borders: tableBorders });
    },

    renderRecordsTableWithTotal(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, totalColumnName: string, useGreenHeader = false): Table {
        const allRecords: any[] = [];
        reports.forEach(r => {
            const records = r.report_data[section.section_key];
            if (Array.isArray(records)) {
                records.forEach(rec => allRecords.push({ ...rec, _dept: deptMap.get(r.department_id) }));
            }
        });

        const hasData = allRecords.length > 0;

        const headerCells = [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "S.No", bold: true, color: "c00000", font: "Calibri", size: 20 })] })], margins: cellPadding }),
            ...section.columns.map(col => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: col.display_name, bold: true, color: "c00000", font: "Calibri", size: 20 })] })],
                margins: cellPadding
            }))
        ];

        const rows = [
            new TableRow({
                children: [new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: section.display_name, bold: true, color: "006600", font: "Calibri", size: 22 })] })],
                    columnSpan: section.columns.length + 1,
                    ...(useGreenHeader ? { shading: snapshotHeaderShading, margins: cellPadding } : {})
                })]
            }),
            new TableRow({ children: headerCells })
        ];

        if (!hasData) {
            rows.push(new TableRow({
                children: [new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "No data available", italics: true, font: "Calibri", size: 20 })], alignment: AlignmentType.CENTER })],
                    columnSpan: section.columns.length + 1
                })]
            }));
        } else {
            allRecords.forEach((rec, i) => {
                rows.push(new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), font: "Calibri", size: 20 })] })], margins: cellPadding }),
                        ...section.columns.map(col => new TableCell({
                            children: [new Paragraph({
                                children: [new TextRun({
                                    text: rec[col.name] !== undefined && rec[col.name] !== null && rec[col.name] !== ''
                                        ? String(rec[col.name])
                                        : '--',
                                    font: "Calibri",
                                    size: 20
                                })]
                            })],
                            margins: cellPadding
                        }))
                    ]
                }));
            });

            // Calculate total for the specified column
            let total = 0;
            allRecords.forEach(rec => {
                const value = parseFloat(rec[totalColumnName]);
                if (!isNaN(value)) {
                    total += value;
                }
            });

            // Add total row with numeric value
            const totalColIndex = section.columns.findIndex(col => col.name === totalColumnName);
            const totalRowCells = [
                new TableCell({ children: [new Paragraph({ children: [] })], margins: cellPadding }),
                ...section.columns.map((col, idx) => {
                    if (idx < totalColIndex) {
                        return new TableCell({ children: [new Paragraph({ children: [] })], margins: cellPadding });
                    } else if (idx === totalColIndex) {
                        return new TableCell({
                            children: [new Paragraph({
                                children: [new TextRun({ text: total.toFixed(2), bold: true, font: "Calibri", size: 20 })],
                                alignment: AlignmentType.CENTER
                            })],
                            margins: cellPadding,
                            columnSpan: section.columns.length - totalColIndex
                        });
                    } else {
                        return null; // These cells are covered by colspan
                    }
                }).filter(cell => cell !== null)
            ];

            rows.push(new TableRow({ children: totalRowCells as TableCell[] }));

            // Add total description row (in words)
            let totalDescription = '';
            if (section.section_key === 'project_proposals') {
                totalDescription = `Total Project Proposals submitted Rs.${total.toFixed(2)} lakhs`;
            }

            if (totalDescription) {
                rows.push(new TableRow({
                    children: [new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: totalDescription, bold: true, font: "Calibri", size: 20 })],
                            alignment: AlignmentType.LEFT
                        })],
                        columnSpan: section.columns.length + 1,
                        margins: cellPadding
                    })]
                }));
            }
        }

        return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, borders: tableBorders });
    },

    renderConsultancyProjectsTable(section: SectionMetadata, reports: any[], deptMap: Map<number, string>): Table {
        const allRecords: any[] = [];
        reports.forEach(r => {
            const records = r.report_data[section.section_key];
            if (Array.isArray(records)) {
                records.forEach(rec => allRecords.push({ ...rec, _dept: deptMap.get(r.department_id) }));
            }
        });

        const hasData = allRecords.length > 0;

        const headerCells = [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "S.No", bold: true, color: "c00000", font: "Calibri", size: 20 })] })], margins: cellPadding }),
            ...section.columns.map(col => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: col.display_name, bold: true, color: "c00000", font: "Calibri", size: 20 })] })],
                margins: cellPadding
            }))
        ];

        const rows = [
            new TableRow({
                children: [new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: section.display_name, bold: true, color: "006600", font: "Calibri", size: 22 })] })],
                    columnSpan: section.columns.length + 1
                })]
            }),
            new TableRow({ children: headerCells })
        ];

        if (!hasData) {
            rows.push(new TableRow({
                children: [new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "No data available", italics: true, font: "Calibri", size: 20 })], alignment: AlignmentType.CENTER })],
                    columnSpan: section.columns.length + 1
                })]
            }));
        } else {
            allRecords.forEach((rec, i) => {
                rows.push(new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), font: "Calibri", size: 20 })] })], margins: cellPadding }),
                        ...section.columns.map(col => new TableCell({
                            children: [new Paragraph({
                                children: [new TextRun({
                                    text: rec[col.name] !== undefined && rec[col.name] !== null && rec[col.name] !== ''
                                        ? String(rec[col.name])
                                        : '--',
                                    font: "Calibri",
                                    size: 20
                                })]
                            })],
                            margins: cellPadding
                        }))
                    ]
                }));
            });

            // Find the "Received" or amount column to calculate total
            // Common column names: received_in_lakhs, amount_received, received, etc.
            const amountColumn = section.columns.find(col =>
                col.name.toLowerCase().includes('received') ||
                col.name.toLowerCase().includes('amount')
            );

            if (amountColumn) {
                let total = 0;
                allRecords.forEach(rec => {
                    const value = parseFloat(rec[amountColumn.name]);
                    if (!isNaN(value)) {
                        total += value;
                    }
                });

                // Add total row with "Total" label and numeric value
                const totalColIndex = section.columns.findIndex(col => col.name === amountColumn.name);
                const totalRowCells = [
                    new TableCell({ children: [new Paragraph({ children: [] })], margins: cellPadding }),
                    ...section.columns.map((col, idx) => {
                        if (idx < totalColIndex) {
                            return new TableCell({ children: [new Paragraph({ children: [] })], margins: cellPadding });
                        } else if (idx === totalColIndex) {
                            return new TableCell({
                                children: [new Paragraph({
                                    children: [new TextRun({ text: total.toFixed(2), bold: true, font: "Calibri", size: 20 })],
                                    alignment: AlignmentType.CENTER
                                })],
                                margins: cellPadding,
                                columnSpan: section.columns.length - totalColIndex
                            });
                        } else {
                            return null; // These cells are covered by colspan
                        }
                    }).filter(cell => cell !== null)
                ];

                rows.push(new TableRow({ children: totalRowCells as TableCell[] }));

                // Add total description row
                rows.push(new TableRow({
                    children: [new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({
                                text: `Total amount received towards Applied/Sanctioned Consultancy Rs.${total.toFixed(2)} lakhs.`,
                                bold: true,
                                font: "Calibri",
                                size: 20
                            })],
                            alignment: AlignmentType.LEFT
                        })],
                        columnSpan: section.columns.length + 1,
                        margins: cellPadding
                    })]
                }));
            }
        }

        return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, borders: tableBorders });
    },

    renderRichTextParagraphs(section: SectionMetadata, reports: any[], deptMap: Map<number, string>): any[] {
        const result: any[] = [
            new Paragraph({
                children: [new TextRun({ text: section.display_name, bold: true, color: "006600", font: "Calibri", size: 22 })]
            })
        ];

        const contentParagraphs: Paragraph[] = [];
        let hasAnyData = false;
        reports.forEach(r => {
            const content = r.report_data[section.section_key];
            if (content && content.trim()) {
                hasAnyData = true;
                contentParagraphs.push(new Paragraph({
                    children: [new TextRun({ text: `${deptMap.get(r.department_id)}:`, bold: true, font: "Calibri", size: 20 })],
                    spacing: { before: 100, after: 100 },
                    border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: "000000" } }
                }));
                const lines = content.split('\n');
                lines.forEach((line: string) => {
                    if (!line.trim()) return;
                    contentParagraphs.push(new Paragraph({
                        children: [new TextRun({ text: line.trim(), font: "Calibri", size: 20 })],
                        bullet: line.trim().startsWith('-') ? { level: 0 } : undefined
                    }));
                });
            }
        });

        if (!hasAnyData) {
            contentParagraphs.push(new Paragraph({ children: [new TextRun({ text: "Nil", italics: true, font: "Calibri", size: 20 })] }));
        }

        result.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            children: contentParagraphs,
                            margins: { top: 200, bottom: 200, left: 200, right: 200 }
                        })
                    ]
                })
            ]
        }));

        return result;
    },


    renderHtmlSection(section: SectionMetadata, reports: any[], deptMap: Map<number, string>, suppressDeptHeader = false, useGreenHeader = false): any[] {
        const result: any[] = [];

        if (useGreenHeader) {
            result.push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: tableBorders,
                rows: [new TableRow({
                    children: [new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: section.display_name, bold: true, color: "006600", font: "Calibri", size: 22 })],
                            spacing: { after: 80, before: 80 }
                        })],
                        shading: snapshotHeaderShading,
                        margins: cellPadding
                    })]
                })]
            }));
        } else {
            result.push(new Paragraph({
                children: [new TextRun({ text: section.display_name, bold: true, color: "006600", font: "Calibri", size: 22 })],
                spacing: { after: 200 }
            }));
        }

        const contentElements: any[] = [];
        let hasAnyData = false;

        const reportsWithData = reports.filter(r => {
            const v = r.report_data[section.section_key];
            return v && typeof v === 'string' && v.trim();
        });

        reports.forEach(r => {
            const htmlContent = r.report_data[section.section_key];
            if (htmlContent && typeof htmlContent === 'string' && htmlContent.trim()) {
                hasAnyData = true;

                // Add department header only when multiple departments contribute and not suppressed
                if (!suppressDeptHeader && reportsWithData.length > 1) {
                    contentElements.push(new Paragraph({
                        children: [new TextRun({
                            text: `${deptMap.get(r.department_id)}:`,
                            bold: true,
                            font: "Calibri",
                            size: 20
                        })],
                        spacing: { before: 200, after: 100 },
                        border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: "000000" } }
                    }));
                }

                // Parse and add HTML content from Tiptap editor
                const parsedElements = parseHtmlToDocx(htmlContent);
                contentElements.push(...parsedElements);
            }
        });

        if (!hasAnyData) {
            contentElements.push(new Paragraph({
                children: [new TextRun({ text: "Nil", italics: true, font: "Calibri", size: 20 })],
                spacing: { before: 100, after: 100 }
            }));
        }

        // Wrap content in a table (consistent with other sections)
        result.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            children: contentElements,
                            margins: { top: 200, bottom: 200, left: 300, right: 200 }
                        })
                    ]
                })
            ]
        }));

        return result;
    },

    // =============================================
    // SNAPSHOT REPORT
    // =============================================
    async generateSnapshotReport(req: any, res: Response): Promise<void> {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.flushHeaders();

        try {
            const { month, year } = req.query;
            if (!month || !year) {
                sendSSE(res, 'error', { message: 'Month and year are required' });
                res.end();
                return;
            }

            const monthNum = parseInt(month as string);
            const yearNum = parseInt(year as string);

            sendSSE(res, 'progress', { percentage: 10, message: 'Fetching metadata...' });

            const SNAPSHOT_KEYS = [
                'snapshot_review_points',
                'snapshot_statutory_compliance',
                'dept_achievements',
                'faculty_achievements',
                'student_achievements',
                'snapshot_placement',
                'snapshot_research',
                'project_proposals',
                'patents',
                'alumni_activities',
                'library_info',
            ];

            // Fetch section metadata joined with config for this month/year
            const sectionsResult = await pool.query(`
                SELECT sm.*, sc.config
                FROM section_metadata sm
                LEFT JOIN section_config sc
                  ON sc.section_key = sm.section_key
                 AND sc.month = $2
                 AND sc.year  = $3
                WHERE sm.section_key = ANY($1) AND sm.is_active = true
            `, [SNAPSHOT_KEYS, monthNum, yearNum]);

            const sectionsMap = new Map(sectionsResult.rows.map((s: any) => [s.section_key, s]));

            // Override display_name for achievements sub-sections
            const achievementsOverrides: Record<string, string> = {
                'dept_achievements':    '(i) Institute/Department Major Achievements:',
                'faculty_achievements': '(ii) Faculty Major Achievements:',
                'student_achievements': '(iii) Students Major Achievements:',
            };

            const sections = SNAPSHOT_KEYS
                .map(key => {
                    const s = sectionsMap.get(key);
                    if (!s) return null;
                    return achievementsOverrides[key]
                        ? { ...s, display_name: achievementsOverrides[key] }
                        : s;
                })
                .filter(Boolean) as SectionMetadata[];

            sendSSE(res, 'progress', { percentage: 25, message: 'Fetching report data...' });

            const reportsResult = await pool.query(`
                SELECT mr.*, d.name as dept_name
                FROM monthly_reports mr
                JOIN departments d ON mr.department_id = d.id
                WHERE mr.month = $1 AND mr.year = $2
            `, [monthNum, yearNum]);
            const reports = reportsResult.rows;

            const deptsResult = await pool.query(`SELECT id, name FROM departments ORDER BY name ASC`);
            const deptMap = new Map<number, string>(deptsResult.rows.map((d: any) => [d.id, d.name]));

            sendSSE(res, 'progress', { percentage: 40, message: 'Loading resources...' });
            const bannerBuffer = loadHeaderBanner();

            sendSSE(res, 'progress', { percentage: 50, message: 'Generating document...' });

            const docChildren: any[] = [
                createVNRHeader(bannerBuffer),
                new Paragraph({ children: [], spacing: { after: 200 } }),
                this.createSnapshotTitle(monthNum, yearNum),
                new Paragraph({ children: [], spacing: { after: 400 } }),
            ];

            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];
                const pct = 50 + ((i + 1) / (sections.length + 1)) * 40;
                sendSSE(res, 'progress', { percentage: Math.round(pct), message: `Rendering ${section.display_name}...` });

                // Inject "3. IMPORTANT ACHIEVEMENTS" header before first achievement section
                if (section.section_key === 'dept_achievements') {
                    docChildren.push(new Paragraph({
                        children: [new TextRun({ text: '3. IMPORTANT ACHIEVEMENTS', font: 'Calibri', size: 22, bold: true, color: '006600' })],
                        spacing: { before: 200, after: 100 }
                    }));
                }

                const renderer = (this as any)[`render_${section.section_key}`];
                let sectionChildren: any[] = [];
                if (typeof renderer === 'function') {
                    sectionChildren = renderer.call(this, section, reports, deptMap, yearNum, true);
                } else {
                    sectionChildren = this.renderSingleSection(section, reports, deptMap);
                }

                if (sectionChildren.length > 0) {
                    docChildren.push(...sectionChildren);
                    docChildren.push(new Paragraph({ children: [], spacing: { before: 300, after: 200 } }));
                }
            }

            // Section 10: Auto-generated publications summary
            sendSSE(res, 'progress', { percentage: 93, message: 'Generating publications summary...' });
            docChildren.push(this.renderPublicationsSummaryTable(reports, deptMap));

            sendSSE(res, 'progress', { percentage: 96, message: 'Finalizing...' });

            const doc = new Document({
                sections: [{
                    properties: {
                        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
                    },
                    children: docChildren
                }]
            });

            const buffer = await Packer.toBuffer(doc);
            const shortMonthName = fullMonths[monthNum - 1]?.slice(0, 3).toUpperCase() || 'UNK';
            const fileName = `VNRVJIET SNAPSHOT - ${shortMonthName} ${yearNum}.docx`;

            sendSSE(res, 'complete', {
                data: buffer.toString('base64'),
                fileName,
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            res.end();

        } catch (error) {
            logger.error(`[SNAPSHOT-GEN] ERROR: ${(error as Error).message}`);
            logger.error(`[SNAPSHOT-GEN] Stack: ${(error as Error).stack}`);
            sendSSE(res, 'error', { message: 'Snapshot generation failed' });
            res.end();
        }
    },

    createSnapshotTitle(month: number, year: number): Paragraph {
        const monthName = fullMonths[month - 1] || 'Unknown';
        return new Paragraph({
            children: [new TextRun({
                text: `${monthName.toUpperCase()} ${year} REPORT`,
                font: 'Calibri',
                size: 40,
                bold: true,
                underline: { type: 'single', color: '000000' }
            })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
        });
    },

    render_snapshot_review_points(section: SectionMetadata, reports: any[], deptMap: Map<number, string>) {
        // Collect content — only ADMIN dept fills this, never show dept name
        const contentElements: any[] = [];
        let hasData = false;

        reports.forEach(r => {
            const html = r.report_data[section.section_key];
            if (html && typeof html === 'string' && html.trim()) {
                hasData = true;
                contentElements.push(...parseHtmlToDocx(html));
            }
        });

        if (!hasData) {
            contentElements.push(new Paragraph({
                children: [new TextRun({ text: 'Nil', italics: true, font: 'Calibri', size: 20 })],
            }));
        }

        const table = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [
                // Green header row
                new TableRow({
                    children: [new TableCell({
                        shading: snapshotHeaderShading,
                        children: [new Paragraph({
                            children: [new TextRun({ text: section.display_name, bold: true, color: '006600', font: 'Calibri', size: 22 })],
                            spacing: { before: 80, after: 80 },
                        })],
                        margins: cellPadding,
                    })]
                }),
                // Content row
                new TableRow({
                    children: [new TableCell({
                        children: contentElements,
                        margins: { top: 200, bottom: 200, left: 300, right: 200 },
                    })]
                }),
            ],
        });

        return [
            table,
            new Paragraph({ children: [], spacing: { before: 200, after: 200 } }),
        ];
    },

    render_snapshot_statutory_compliance(section: SectionMetadata, reports: any[], deptMap: Map<number, string>) {
        const fixedRows = section.fixed_rows || [];

        let data: Record<string, any> = {};
        reports.forEach((r: any) => {
            const records = r.report_data[section.section_key];
            if (Array.isArray(records)) {
                records.forEach((rec: any) => { if (rec.dept) data[rec.dept] = rec; });
            }
        });

        const rows: TableRow[] = [
            new TableRow({
                children: [new TableCell({
                    shading: snapshotHeaderShading,
                    children: [new Paragraph({ children: [new TextRun({ text: section.display_name, bold: true, color: '006600', font: 'Calibri', size: 22 })], spacing: { before: 80, after: 80 } })],
                    columnSpan: 3,
                    margins: cellPadding,
                })]
            }),
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'S.No', bold: true, color: 'c00000', font: 'Calibri', size: 20 })] })], margins: cellPadding }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Statutory Bodies', bold: true, color: 'c00000', font: 'Calibri', size: 20 })] })], margins: cellPadding }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Status / Compliance', bold: true, color: 'c00000', font: 'Calibri', size: 20 })] })], margins: cellPadding })
                ]
            })
        ];

        fixedRows.forEach((rowName: string, idx: number) => {
            const rowData = data[rowName] || {};
            rows.push(new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1), font: 'Calibri', size: 20 })], alignment: AlignmentType.CENTER })], margins: cellPadding }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: rowName, font: 'Calibri', size: 20 })] })], margins: cellPadding }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: rowData.status || '', font: 'Calibri', size: 20 })] })], margins: cellPadding })
                ]
            }));
        });

        return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, borders: tableBorders })];
    },

    render_snapshot_placement(section: SectionMetadata, reports: any[], deptMap: Map<number, string>) {
        const fixedRows = section.fixed_rows || [];
        const batchLabel = (section as any).config?.labels?.batch_label || 'Batch';

        const tableColumns = section.columns.filter(col => col.type !== 'TEXTAREA' && col.type !== 'SINGLE_TEXTAREA');
        const textareaColumns = section.columns.filter(col => col.type === 'TEXTAREA' || col.type === 'SINGLE_TEXTAREA');

        let data: Record<string, any> = {};
        const textareaValues: Record<string, string> = {};

        reports.forEach((r: any) => {
            const records = r.report_data[section.section_key];
            if (Array.isArray(records)) {
                records.forEach((rec: any) => {
                    if (rec.dept) data[rec.dept] = rec;
                });
                // TEXTAREA values stored in first record
                if (records.length > 0) {
                    textareaColumns.forEach(col => {
                        if (records[0][col.name] && !textareaValues[col.name]) {
                            textareaValues[col.name] = records[0][col.name];
                        }
                    });
                }
            }
        });

        const rows: TableRow[] = [
            new TableRow({
                children: [new TableCell({
                    shading: snapshotHeaderShading,
                    children: [new Paragraph({ children: [new TextRun({ text: section.display_name, bold: true, color: '006600', font: 'Calibri', size: 22 })], spacing: { before: 80, after: 80 } })],
                    columnSpan: tableColumns.length + 1,
                    margins: cellPadding,
                })]
            }),
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: batchLabel, bold: true, color: 'c00000', font: 'Calibri', size: 20 })] })], margins: cellPadding }),
                    ...tableColumns.map(col => new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: col.display_name, bold: true, color: 'c00000', font: 'Calibri', size: 20 })] })],
                        margins: cellPadding
                    }))
                ]
            })
        ];

        fixedRows.forEach((rowName: string) => {
            const rowData = data[rowName] || {};
            rows.push(new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: rowName, font: 'Calibri', size: 20 })] })], margins: cellPadding }),
                    ...tableColumns.map(col => new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: rowData[col.name] || '', font: 'Calibri', size: 20 })] })],
                        margins: cellPadding
                    }))
                ]
            }));
        });

        const elements: any[] = [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, borders: tableBorders })];

        // TEXTAREA columns rendered as notes below the table
        textareaColumns.forEach(col => {
            const val = textareaValues[col.name];
            if (val) {
                elements.push(new Paragraph({
                    children: [
                        new TextRun({ text: `${col.display_name}: `, bold: true, font: 'Calibri', size: 20 }),
                        new TextRun({ text: val, font: 'Calibri', size: 20 })
                    ],
                    spacing: { before: 100, after: 100 }
                }));
            }
        });

        return elements;
    },

    render_snapshot_research(section: SectionMetadata, reports: any[], deptMap: Map<number, string>) {
        const fixedRows = section.fixed_rows || [];
        const targetYear = (section as any).config?.labels?.target_year || '';

        const tableColumns = section.columns.filter(col => col.type !== 'TEXTAREA' && col.type !== 'SINGLE_TEXTAREA');
        const textareaColumns = section.columns.filter(col => col.type === 'TEXTAREA' || col.type === 'SINGLE_TEXTAREA');

        let data: Record<string, any> = {};
        const textareaValues: Record<string, string> = {};

        reports.forEach((r: any) => {
            const records = r.report_data[section.section_key];
            if (Array.isArray(records)) {
                records.forEach((rec: any) => { if (rec.dept) data[rec.dept] = rec; });
                if (records.length > 0) {
                    textareaColumns.forEach(col => {
                        if (records[0][col.name] && !textareaValues[col.name]) {
                            textareaValues[col.name] = records[0][col.name];
                        }
                    });
                }
            }
        });

        const rows: TableRow[] = [
            new TableRow({
                children: [new TableCell({
                    shading: snapshotHeaderShading,
                    children: [new Paragraph({ children: [new TextRun({ text: section.display_name, bold: true, color: '006600', font: 'Calibri', size: 22 })], spacing: { before: 80, after: 80 } })],
                    columnSpan: tableColumns.length + 1,
                    margins: cellPadding,
                })]
            }),
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Parameter', bold: true, color: 'c00000', font: 'Calibri', size: 20 })] })], margins: cellPadding }),
                    ...tableColumns.map(col => {
                        const headerText = col.name === 'target' && targetYear
                            ? `${col.display_name} (${targetYear})`
                            : col.display_name;
                        return new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: headerText, bold: true, color: 'c00000', font: 'Calibri', size: 20 })] })],
                            margins: cellPadding
                        });
                    })
                ]
            })
        ];

        fixedRows.forEach((rowName: string) => {
            const rowData = data[rowName] || {};
            rows.push(new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: rowName, font: 'Calibri', size: 20 })] })], margins: cellPadding }),
                    ...tableColumns.map(col => new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: rowData[col.name] || '', font: 'Calibri', size: 20 })] })],
                        margins: cellPadding
                    }))
                ]
            }));
        });

        const elements: any[] = [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, borders: tableBorders })];

        textareaColumns.forEach(col => {
            const val = textareaValues[col.name];
            if (val) {
                elements.push(new Paragraph({
                    children: [
                        new TextRun({ text: `${col.display_name}: `, bold: true, font: 'Calibri', size: 20 }),
                        new TextRun({ text: val, font: 'Calibri', size: 20 })
                    ],
                    spacing: { before: 100, after: 100 }
                }));
            }
        });

        return elements;
    },

    renderPublicationsSummaryTable(reports: any[], deptMap: Map<number, string>): Table {
        const excludedDepartments = ['ADMIN', 'HR', 'ED CELL', 'LIBRARY', 'MTP', 'RDC', 'TEST', 'ALUMNI'];
        const departmentOrder = [
            'CE', 'EEE', 'ME', 'ECE', 'CSE', 'EIE', 'IT', 'AE',
            'CSE (AIML & IoT)', 'CSE (CS, DS) AI&DS',
            'Physics', 'Chemistry', 'English', 'M&MS', 'BIOTECH'
        ];

        const journalCounts = new Map<number, number>();
        const conferenceCounts = new Map<number, number>();

        reports.forEach((r: any) => {
            const journals = r.report_data['journal_publications'];
            if (Array.isArray(journals) && journals.length > 0)
                journalCounts.set(r.department_id, journals.length);
            const conferences = r.report_data['conference_papers'];
            if (Array.isArray(conferences) && conferences.length > 0)
                conferenceCounts.set(r.department_id, conferences.length);
        });

        const allDeptIds = Array.from(deptMap.keys())
            .filter(id => {
                const name = (deptMap.get(id) || '').toUpperCase();
                return !excludedDepartments.some(ex => name === ex.toUpperCase());
            })
            .sort((a, b) => {
                const nameA = deptMap.get(a) || '';
                const nameB = deptMap.get(b) || '';
                const iA = departmentOrder.findIndex(d => d === nameA);
                const iB = departmentOrder.findIndex(d => d === nameB);
                if (iA !== -1 && iB !== -1) return iA - iB;
                if (iA !== -1) return -1;
                if (iB !== -1) return 1;
                return nameA.localeCompare(nameB);
            });

        let totalJournals = 0;
        let totalConference = 0;

        const rows: TableRow[] = [
            new TableRow({
                children: [new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '10. Faculty Publications:', bold: true, color: '006600', font: 'Calibri', size: 22 })] })],
                    columnSpan: 4,
                    shading: snapshotHeaderShading,
                    margins: cellPadding
                })]
            }),
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'S.No', bold: true, color: 'c00000', font: 'Calibri', size: 20 })] })], margins: cellPadding }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Dept.', bold: true, color: 'c00000', font: 'Calibri', size: 20 })] })], margins: cellPadding }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'No. of Journals Published', bold: true, color: 'c00000', font: 'Calibri', size: 20 })] })], margins: cellPadding }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'No. of Papers Presented', bold: true, color: 'c00000', font: 'Calibri', size: 20 })] })], margins: cellPadding })
                ]
            })
        ];

        allDeptIds.forEach((deptId, idx) => {
            const journals = journalCounts.get(deptId) || 0;
            const conferences = conferenceCounts.get(deptId) || 0;
            totalJournals += journals;
            totalConference += conferences;

            rows.push(new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1), font: 'Calibri', size: 20 })], alignment: AlignmentType.CENTER })], margins: cellPadding }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: deptMap.get(deptId) || '', font: 'Calibri', size: 20 })] })], margins: cellPadding }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: journals > 0 ? String(journals) : '-', font: 'Calibri', size: 20 })], alignment: AlignmentType.CENTER })], margins: cellPadding }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: conferences > 0 ? String(conferences) : '-', font: 'Calibri', size: 20 })], alignment: AlignmentType.CENTER })], margins: cellPadding })
                ]
            }));
        });

        rows.push(new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [] })], margins: cellPadding }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL', bold: true, font: 'Calibri', size: 20 })] })], margins: cellPadding }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(totalJournals), bold: true, font: 'Calibri', size: 20 })], alignment: AlignmentType.CENTER })], margins: cellPadding }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(totalConference), bold: true, font: 'Calibri', size: 20 })], alignment: AlignmentType.CENTER })], margins: cellPadding })
            ]
        }));

        return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, borders: tableBorders });
    },

    // Get departments that have data for a specific section
    async getDepartmentsWithData(req: any, res: Response) {
        try {
            const { section_key, month, year } = req.query;

            if (!section_key || !month || !year) {
                return res.status(400).json({ error: 'section_key, month, and year are required' });
            }

            // Get all reports for the given month and year
            const reportsResult = await pool.query(
                `SELECT mr.department_id, d.name as department_name, mr.report_data
                 FROM monthly_reports mr
                 JOIN departments d ON mr.department_id = d.id
                 WHERE mr.month = $1 AND mr.year = $2`,
                [parseInt(month as string), parseInt(year as string)]
            );

            // Filter departments that have data for the specific section
            const departmentsWithData: Array<{ id: number; name: string }> = [];
            const addedDeptIds = new Set<number>();

            reportsResult.rows.forEach(row => {
                const sectionData = row.report_data?.[section_key as string];

                // Check if section has meaningful data
                const hasData = sectionData && (
                    // For arrays (records, fixed_table): check if not empty
                    (Array.isArray(sectionData) && sectionData.length > 0) ||
                    // For objects (single_value): check if has any non-empty values
                    (typeof sectionData === 'object' && !Array.isArray(sectionData) &&
                     Object.values(sectionData).some(val => val !== '' && val !== null && val !== undefined)) ||
                    // For strings (rich_text): check if not empty
                    (typeof sectionData === 'string' && sectionData.trim() !== '')
                );

                if (hasData && !addedDeptIds.has(row.department_id)) {
                    // Exclude ADMIN and TEST departments
                    const deptName = row.department_name?.toUpperCase();
                    if (deptName !== 'TEST') {
                        departmentsWithData.push({
                            id: row.department_id,
                            name: row.department_name
                        });
                        addedDeptIds.add(row.department_id);
                    }
                }
            });

            // Sort departments by name
            departmentsWithData.sort((a, b) => a.name.localeCompare(b.name));

            logger.info(`Found ${departmentsWithData.length} departments with data for section ${section_key}`);
            res.json({ departments: departmentsWithData });
        } catch (error) {
            logger.error(`Failed to fetch departments with data: ${(error as Error).message}`);
            res.status(500).json({ error: 'Failed to fetch departments' });
        }
    }
};