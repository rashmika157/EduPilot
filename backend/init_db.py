import pymysql
from sqlalchemy import create_engine
from backend.config import settings
from backend.models import Base

def initialize_database():
    print("--------------------------------------------------")
    print("EduPilot - Initializing MySQL Database & Schema...")
    print("--------------------------------------------------")
    
    # 1. Establish initial raw connection to create the schema if missing
    try:
        connection = pymysql.connect(
            host=settings.DB_HOST,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            port=int(settings.DB_PORT)
        )
        
        with connection.cursor() as cursor:
            # Create Database statement
            sql = f"CREATE DATABASE IF NOT EXISTS `{settings.DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            cursor.execute(sql)
            print(f"[OK] MySQL Database schema '{settings.DB_NAME}' verified/created.")
            
        connection.close()
    except Exception as e:
        print("[ERROR] Failed to connect to MySQL Server to verify database schema:")
        print(f"        {str(e)}")
        print("        Please verify MySQL is running, check credentials in backend/.env,")
        print("        and ensure that your MySQL user has rights to create databases.")
        return False

    # 2. Use SQLAlchemy to create tables
    try:
        engine = create_engine(settings.DATABASE_URL)
        Base.metadata.create_all(bind=engine)
        print("[OK] SQLAlchemy schema tables ('users', 'notes', 'topics', 'subtopics', 'quiz_attempts', 'user_analytics') verified/created.")
        
        # 3. Alter existing tables if columns are missing
        try:
            connection = pymysql.connect(
                host=settings.DB_HOST,
                user=settings.DB_USER,
                password=settings.DB_PASSWORD,
                port=int(settings.DB_PORT),
                database=settings.DB_NAME
            )
            with connection.cursor() as cursor:
                # Check topic_extraction_status on notes
                cursor.execute("SHOW COLUMNS FROM `notes` LIKE 'topic_extraction_status';")
                if not cursor.fetchone():
                    cursor.execute("ALTER TABLE `notes` ADD COLUMN `topic_extraction_status` VARCHAR(50) DEFAULT 'pending';")
                    print("[OK] Column 'topic_extraction_status' added to 'notes' table.")

                # Check extraction_confidence on notes
                cursor.execute("SHOW COLUMNS FROM `notes` LIKE 'extraction_confidence';")
                if not cursor.fetchone():
                    cursor.execute("ALTER TABLE `notes` ADD COLUMN `extraction_confidence` FLOAT DEFAULT NULL;")
                    print("[OK] Column 'extraction_confidence' added to 'notes' table.")

                # Check parent_id on subtopics
                cursor.execute("SHOW COLUMNS FROM `subtopics` LIKE 'parent_id';")
                if not cursor.fetchone():
                    cursor.execute("ALTER TABLE `subtopics` ADD COLUMN `parent_id` INT DEFAULT NULL;")
                    cursor.execute("ALTER TABLE `subtopics` ADD CONSTRAINT `fk_subtopics_parent` FOREIGN KEY (`parent_id`) REFERENCES `subtopics` (`id`) ON DELETE CASCADE;")
                    print("[OK] Column 'parent_id' and constraint 'fk_subtopics_parent' added to 'subtopics' table.")

            connection.close()
        except Exception as alter_err:
            print(f"[WARNING] Database alter check skipped: {alter_err}")
            
        print("--------------------------------------------------")
        print("[SUCCESS] Database setup completed successfully!")
        print("--------------------------------------------------")
        return True
    except Exception as e:
        print(f"[ERROR] SQLAlchemy schema creation failed: {str(e)}")
        return False

if __name__ == "__main__":
    initialize_database()
