# Database folder

This folder is for database setup only.

- `mariadb/init` contains SQL files that create tables, seed lookup rows, add indexes, views, triggers, sample data, and auth password support.
- `mongodb/init` contains the MongoDB init script for collections, indexes, and demo documents.

These files are mounted into Docker and run only when the database volume is first created.
