# Database folder

This folder is for database setup only.

- `mariadb/init` contains SQL files that create the schema, seed lookup rows, add indexes, views, triggers and cache refresh SQL.
- `mongodb/init` contains the MongoDB init script for creating the final collections and indexes.Dataset-backed documents are loaded by `etl/scripts/import_mongodb.py`.

These files are mounted into Docker and run only when the database volume is first created.
