import os
import shutil
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.config import settings
from backend.models import (
    User,
    Note,
    Topic,
    Subtopic,
    ChatSession,
    ChatMessage,
    YoutubeVideoCache,
    UserTopicProgress,
    QuizAttempt,
    UserAnalytics,
)


def get_session():
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


def clear_database(session):
    print("Clearing backend database records...")
    models_in_deletion_order = [
        ChatMessage,
        ChatSession,
        UserTopicProgress,
        QuizAttempt,
        UserAnalytics,
        YoutubeVideoCache,
        Subtopic,
        Topic,
        Note,
        User,
    ]

    for model in models_in_deletion_order:
        deleted = session.query(model).delete(synchronize_session=False)
        print(f"  Deleted {deleted} rows from {model.__tablename__}.")

    session.commit()
    print("Database cleanup complete.")


def clear_upload_files():
    upload_dir = settings.UPLOAD_DIR
    if not os.path.isdir(upload_dir):
        print(f"Upload directory not found: {upload_dir}")
        return

    print(f"Clearing files from upload directory: {upload_dir}")
    for entry in os.listdir(upload_dir):
        path = os.path.join(upload_dir, entry)
        try:
            if os.path.isfile(path) or os.path.islink(path):
                os.remove(path)
                print(f"  Removed file: {entry}")
            elif os.path.isdir(path):
                shutil.rmtree(path)
                print(f"  Removed directory: {entry}")
        except Exception as exc:
            print(f"  Failed to remove {entry}: {exc}")


def confirm_action():
    if "--yes" in sys.argv or "-y" in sys.argv:
        return True

    prompt = (
        "This will permanently delete all users, notes, related metadata, and uploaded files. "
        "Type YES to proceed: "
    )
    answer = input(prompt).strip()
    return answer == "YES"


def main():
    if not confirm_action():
        print("Aborted. No data was changed.")
        return

    try:
        with get_session() as session:
            clear_database(session)
    except Exception as exc:
        print(f"Failed to clear database: {exc}")
        return

    clear_upload_files()
    print("All user data and uploads have been cleared.")


if __name__ == "__main__":
    main()
