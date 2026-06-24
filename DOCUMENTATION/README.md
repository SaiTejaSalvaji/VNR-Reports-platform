# VNR Reports Documentation

Welcome to the official, enterprise-grade technical documentation for the **VNR Reports** project.

This documentation is designed to serve multiple purposes:
1. **Onboarding**: Help new engineers understand the architecture and get the system running locally within an hour.
2. **Maintenance**: Provide deep dives into complex flows (like dynamic UI rendering and JSONB database management) to assist in debugging and scaling.
3. **Interview Preparation**: Act as a reverse-engineering guide to help you explain this project confidently in system design and full-stack interviews.

## 📚 Documentation Index

### Overview & Setup
* [00 Project Overview](./00_PROJECT_OVERVIEW.md) - High-level summary for all audiences.
* [02 Folder Structure](./02_FOLDER_STRUCTURE.md) - Navigating the Monorepo.
* [03 Setup and Installation](./03_SETUP_AND_INSTALLATION.md) - How to run the project locally.

### Architecture & Design
* [01 Architecture Overview](./01_ARCHITECTURE.md) - System architecture and Mermaid diagrams.
* [04 Data Flow](./04_DATA_FLOW.md) - How data travels from UI to DB.
* [07 Database Design](./07_DATABASE_DESIGN.md) - PostgreSQL schema, relations, and the JSONB engine.
* [11 Design Patterns](./11_DESIGN_PATTERNS.md) - Software patterns utilized in the codebase.

### Deep Dives
* [05 Backend Deep Dive](./05_BACKEND_DEEP_DIVE.md) - Express, middleware, and controllers.
* [06 Frontend Deep Dive](./06_FRONTEND_DEEP_DIVE.md) - React, Vite, Context, and dynamic rendering.
* [08 API Documentation](./08_API_DOCUMENTATION.md) - High-level endpoint reference.
* [09 Authentication & Security](./09_AUTHENTICATION_AND_SECURITY.md) - JWTs, RBAC, and threat vectors.
* [10 State Management](./10_STATE_MANAGEMENT.md) - How React Context handles data sync.

### DevOps & Scaling
* [12 Deployment](./12_DEPLOYMENT.md) - Serverless hosting (Vercel/Firebase) and Neon DB.
* [13 Performance Optimization](./13_PERFORMANCE_OPTIMIZATION.md) - Code splitting, caching, and DB indexing.
* [14 Scalability Analysis](./14_SCALABILITY_ANALYSIS.md) - Bottlenecks and how to scale to 100+ institutes.
* [17 Troubleshooting](./17_TROUBLESHOOTING.md) - Fixes for common dev/prod issues.

### Mastery & Career
* [15 Interview Preparation](./15_INTERVIEW_PREPARATION.md) - Sample Q&A, STAR format answers, and resume summary.
* [16 Rebuild from Scratch Guide](./16_REBUILD_FROM_SCRATCH_GUIDE.md) - Step-by-step tutorial to rebuild this architecture.
* [18 Glossary](./18_GLOSSARY.md) - Definitions for acronyms and specific terms.

---

## 🗺️ Learning Roadmap: How to Master This Codebase

If you are new to the project, do not read the code randomly. Follow this roadmap:

1. **Start with the Database**: Read `07_DATABASE_DESIGN.md`. Understand how `section_metadata` and `monthly_reports` interact using JSONB. This is the heart of the application.
2. **Understand the Setup**: Read `03_SETUP_AND_INSTALLATION.md` and get the app running locally.
3. **Trace a Request**: Read `04_DATA_FLOW.md`. Open the app, type a test publication into the UI, and click save. Follow that payload through the React Network tab -> Express Controller -> PostgreSQL DB.
4. **Learn the Frontend Magic**: Read `06_FRONTEND_DEEP_DIVE.md` and inspect `ReportEditor.tsx` to see how it builds a UI out of a JSON schema.
5. **Prepare for Interviews**: Read `15_INTERVIEW_PREPARATION.md` to learn how to articulate these complex systems professionally.
