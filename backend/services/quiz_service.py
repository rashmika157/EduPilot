import json
import re
from typing import List, Dict, Any
import google.generativeai as genai
from backend.config import settings

FALLBACK_QUIZZES = {
    "os": [
        {
            "question": "What is the primary role of a Kernel in an Operating System?",
            "options": [
                "A) Manage CPU, memory, and core system resources",
                "B) Render user interface layouts and buttons",
                "C) Sort disk files alphabetically",
                "D) Format document text styles"
            ],
            "correct_index": 0,
            "explanation": "The Kernel is the core component of an OS that manages hardware resources (CPU, RAM, devices) and acts as a bridge between applications and hardware."
        },
        {
            "question": "Which of the following is a valid process state in most operating systems?",
            "options": [
                "A) Running",
                "B) Ready",
                "C) Blocked / Waiting",
                "D) All of the above"
            ],
            "correct_index": 3,
            "explanation": "Process state transitions include Ready (waiting for CPU), Running (executing instructions), and Blocked/Waiting (waiting for an I/O event), as well as Terminated and New."
        },
        {
            "question": "What is the key difference between a process and a thread?",
            "options": [
                "A) A thread runs inside a process and shares its address space, whereas a process has its own isolated memory space",
                "B) A process runs inside a thread to save CPU cycles",
                "C) Threads do not share memory with other threads in the same process",
                "D) Processes can share address spaces directly without IPC"
            ],
            "correct_index": 0,
            "explanation": "Threads are lightweight processes. Multiple threads belonging to the same process share code, data, and resources, but each thread has its own program counter and stack."
        },
        {
            "question": "What is virtual memory?",
            "options": [
                "A) A hardware memory management technique that maps virtual addresses to physical disk/RAM addresses",
                "B) Simulated cloud storage for database backup",
                "C) The graphics card's dedicated video RAM",
                "D) CPU cache memory registers"
            ],
            "correct_index": 0,
            "explanation": "Virtual memory allows execution of processes that might not be fully in physical memory by swapping pages between RAM and disk storage."
        },
        {
            "question": "What is a deadlock in an operating system environment?",
            "options": [
                "A) A situation where two or more processes are blocked indefinitely, each waiting for a resource held by another",
                "B) A system crash caused by high power consumption",
                "C) Corruption of the Master Boot Record",
                "D) A memory leak that consumes all physical RAM"
            ],
            "correct_index": 0,
            "explanation": "A deadlock occurs when a set of processes are blocked because each process is holding a resource and waiting for another resource acquired by some other process."
        },
        {
            "question": "Which CPU scheduling algorithm allocates the processor to the process that arrives first?",
            "options": [
                "A) First-Come, First-Served (FCFS)",
                "B) Round Robin (RR)",
                "C) Shortest Job First (SJF)",
                "D) Multilevel Queue"
            ],
            "correct_index": 0,
            "explanation": "FCFS is a non-preemptive scheduling algorithm that queues incoming processes and executes them in order of arrival."
        },
        {
            "question": "What is thrashing in OS virtual memory management?",
            "options": [
                "A) Excessive page swapping between RAM and disk, leading to low CPU utilization",
                "B) Cleaning up cached background operations",
                "C) Overclocking the CPU beyond safe limits",
                "D) Re-indexing files on a hard drive"
            ],
            "correct_index": 0,
            "explanation": "Thrashing occurs when the system spends more time swapping pages in and out of memory than executing actual process instructions."
        },
        {
            "question": "Which system call is commonly used in Unix-like systems to create a new process?",
            "options": [
                "A) fork()",
                "B) exec()",
                "C) wait()",
                "D) exit()"
            ],
            "correct_index": 0,
            "explanation": "The fork() system call creates a new child process which is a duplicate of the calling parent process."
        },
        {
            "question": "What is the purpose of a Translation Lookaside Buffer (TLB)?",
            "options": [
                "A) To cache virtual-to-physical address translations for faster memory access",
                "B) To translate source code variables into assembly instructions",
                "C) To buffer keystrokes during keyboard input interrupt handling",
                "D) To manage audio output streams"
            ],
            "correct_index": 0,
            "explanation": "A TLB is a hardware cache that memory management units (MMUs) use to speed up virtual address translation."
        },
        {
            "question": "What defines the difference between User Mode and Kernel Mode?",
            "options": [
                "A) Kernel Mode has unrestricted access to hardware, whereas User Mode is restricted to protect system stability",
                "B) User Mode has hardware access but Kernel Mode does not",
                "C) Kernel Mode is slower because it is virtualized",
                "D) The modes are identical in terms of CPU instructions execution rights"
            ],
            "correct_index": 0,
            "explanation": "Operating systems use modes to protect hardware: User Mode runs user applications with restricted privileges, while Kernel Mode runs core OS functions with full privileges."
        }
    ],
    "dbms": [
        {
            "question": "What does SQL stand for?",
            "options": [
                "A) Structured Query Language",
                "B) Standard Question Log",
                "C) Systematic Query Logic",
                "D) Sequential Query Language"
            ],
            "correct_index": 0,
            "explanation": "SQL stands for Structured Query Language, the standard programming language for managing relational databases."
        },
        {
            "question": "Which SQL clause is used to filter query results to match a specific criteria?",
            "options": [
                "A) WHERE",
                "B) GROUP BY",
                "C) ORDER BY",
                "D) SELECT"
            ],
            "correct_index": 0,
            "explanation": "The WHERE clause is used to filter records and return only those that satisfy a specified condition."
        },
        {
            "question": "What is a Primary Key in a relational database?",
            "options": [
                "A) A column or set of columns that uniquely identifies each row in a table",
                "B) A master password to access database schemas",
                "C) The first column defined in a table",
                "D) An index used exclusively for full-text searches"
            ],
            "correct_index": 0,
            "explanation": "A Primary Key must contain unique values and cannot contain NULL values, ensuring entity integrity."
        },
        {
            "question": "What is a Foreign Key?",
            "options": [
                "A) A column in one table that references the Primary Key of another table to establish a relationship",
                "B) An administrator credential from a different server",
                "C) A key used to encrypt connection strings",
                "D) A column containing only numeric values"
            ],
            "correct_index": 0,
            "explanation": "Foreign Keys enforce referential integrity by linking tables together through shared columns."
        },
        {
            "question": "What is the primary goal of Database Normalization?",
            "options": [
                "A) Minimizing data redundancy and preventing insertion/update/deletion anomalies",
                "B) Compressing files to save local disk storage",
                "C) Creating database indexes on every column",
                "D) Standardizing backup locations across servers"
            ],
            "correct_index": 0,
            "explanation": "Normalization organizes fields and tables to ensure dependencies are properly enforced, reducing data duplication."
        },
        {
            "question": "Which SQL JOIN returns all records when there is a match in either left or right table?",
            "options": [
                "A) FULL OUTER JOIN",
                "B) INNER JOIN",
                "C) LEFT JOIN",
                "D) CROSS JOIN"
            ],
            "correct_index": 0,
            "explanation": "FULL OUTER JOIN returns all rows from the joined tables, matching records where possible and inserting NULLs where matches don't exist."
        },
        {
            "question": "What is an index in a database table?",
            "options": [
                "A) A separate data structure that improves the speed of data retrieval operations",
                "B) A backup copy of the table structure",
                "C) An auto-incrementing integer key",
                "D) The version number of the database engine"
            ],
            "correct_index": 0,
            "explanation": "Indices speed up SELECT queries by avoiding full-table scans, though they add overhead to INSERT/UPDATE write operations."
        },
        {
            "question": "What does the ACID model guarantee in database transactions?",
            "options": [
                "A) Atomicity, Consistency, Isolation, and Durability",
                "B) Access, Control, Indexing, and Directories",
                "C) Active, Current, Indexed, and Documented",
                "D) None of the above"
            ],
            "correct_index": 0,
            "explanation": "ACID properties guarantee that database transactions are processed reliably: Atomicity (all-or-nothing), Consistency (integrity), Isolation (concurrency), and Durability (persistence)."
        },
        {
            "question": "What is a database transaction Rollback?",
            "options": [
                "A) Undoing all modifications made during the current uncommitted transaction",
                "B) Deleasing a table schema from a backup file",
                "C) Moving data from local drives to cloud archives",
                "D) Restarting the database daemon process"
            ],
            "correct_index": 0,
            "explanation": "Rollback aborts a transaction block and returns the database state to the checkpoint before the transaction started."
        },
        {
            "question": "Which SQL operation removes all rows from a table without logging individual row deletions?",
            "options": [
                "A) TRUNCATE",
                "B) DELETE",
                "C) DROP",
                "D) ALTER"
            ],
            "correct_index": 0,
            "explanation": "TRUNCATE is a DDL command that quickly removes all records from a table by deallocating the pages used to store the table data, bypassing delete triggers."
        }
    ],
    "network": [
        {
            "question": "What does TCP stand for?",
            "options": [
                "A) Transmission Control Protocol",
                "B) Telecommunication Connection Path",
                "C) Transfer Cipher Protocol",
                "D) Terminal Channel Packet"
            ],
            "correct_index": 0,
            "explanation": "TCP is Transmission Control Protocol, a core protocol of the Internet protocol suite providing reliable, ordered delivery of data streams."
        },
        {
            "question": "Which OSI layer is responsible for packet routing, addressing, and forwarding?",
            "options": [
                "A) Network Layer (Layer 3)",
                "B) Transport Layer (Layer 4)",
                "C) Data Link Layer (Layer 2)",
                "D) Physical Layer (Layer 1)"
            ],
            "correct_index": 0,
            "explanation": "The Network Layer manages logical addressing (IP) and determines path routing for sending packets across networks."
        },
        {
            "question": "What is the primary function of a Domain Name System (DNS)?",
            "options": [
                "A) Translating human-friendly domain names into IP addresses",
                "B) Directing local printer network jobs",
                "C) Encrypting web communications via SSL",
                "D) Hosting web servers on physical machines"
            ],
            "correct_index": 0,
            "explanation": "DNS translates domain names (like google.com) into physical IP addresses (like 142.250.190.46) so browsers can load internet resources."
        },
        {
            "question": "What is a Subnet Mask used for?",
            "options": [
                "A) To distinguish the network ID from the host ID in an IP address",
                "B) To block unauthorized ports from internet access",
                "C) To hide the local user's mac address",
                "D) To encrypt web browser requests"
            ],
            "correct_index": 0,
            "explanation": "Subnet masks define the size of a subnet: binary '1's represent the network routing prefix, while '0's represent host addresses."
        },
        {
            "question": "What is the role of DHCP in computer networking?",
            "options": [
                "A) Dynamically assigning IP addresses and network configuration details to devices",
                "B) Compiling web pages locally",
                "C) Authenticating users during wireless logins",
                "D) Transferring email messages between mail servers"
            ],
            "correct_index": 0,
            "explanation": "DHCP (Dynamic Host Configuration Protocol) automatically configures clients with IP addresses, gateways, and DNS servers upon joining a network."
        },
        {
            "question": "Which network protocol is used to fetch web page content securely?",
            "options": [
                "A) HTTPS",
                "B) HTTP",
                "C) FTP",
                "D) SMTP"
            ],
            "correct_index": 0,
            "explanation": "HTTPS (Hypertext Transfer Protocol Secure) encrypts communication channels using TLS/SSL to prevent eavesdropping and data tampering."
        },
        {
            "question": "What is the default port number used by HTTP web traffic?",
            "options": [
                "A) Port 80",
                "B) Port 443",
                "C) Port 22",
                "D) Port 21"
            ],
            "correct_index": 0,
            "explanation": "HTTP defaults to port 80, while secure HTTPS traffic defaults to port 443."
        },
        {
            "question": "What is the function of a Router?",
            "options": [
                "A) Connecting multiple different networks and forwarding packets based on destination IP addresses",
                "B) Generating signal waves for local screens",
                "C) Running host databases locally",
                "D) Storing physical file backups"
            ],
            "correct_index": 0,
            "explanation": "Routers operate at Layer 3 to bridge networks (e.g. connecting a home LAN to the ISP internet gateway)."
        },
        {
            "question": "What constitutes packet loss in network performance?",
            "options": [
                "A) Sent packets that fail to reach their destination",
                "B) Compressed file attachments in emails",
                "C) Hacking attempts that drop router power",
                "D) Erasing a database index"
            ],
            "correct_index": 0,
            "explanation": "Packet loss happens when data packets traveling across the network are dropped due to congestion, signal degradation, or faulty hardware."
        },
        {
            "question": "Which loopback address is standard for localhost configurations?",
            "options": [
                "A) 127.0.0.1",
                "B) 192.168.1.1",
                "C) 10.0.0.1",
                "D) 255.255.255.255"
            ],
            "correct_index": 0,
            "explanation": "The address range 127.0.0.0/8 is reserved for loopback checks, with 127.0.0.1 being the standard localhost address."
        }
    ],
    "generic": [
        {
            "question": "What is the Feynman Technique for learning?",
            "options": [
                "A) Explaining a concept in simple, plain terms to another person to identify gaps in your own understanding",
                "B) Reviewing notes exactly 10 times consecutively",
                "C) Memorizing cheat sheets the night before an exam",
                "D) Speed-reading textbook chapters without pausing"
            ],
            "correct_index": 0,
            "explanation": "The Feynman Technique uses active teaching/simplification to translate complex topics into simple metaphors, exposing gaps in your memory."
        },
        {
            "question": "How is the Pomodoro Technique structured?",
            "options": [
                "A) 25 minutes of deep focus followed by a 5-minute break",
                "B) 4 hours of uninterrupted cramming",
                "C) Eating light snacks while listening to music",
                "D) Studying only on alternate days of the week"
            ],
            "correct_index": 0,
            "explanation": "The Pomodoro Technique is a time-management method that breaks work into intervals separated by short breaks, sustaining focus and preventing fatigue."
        },
        {
            "question": "According to cognitive science, which study method results in the highest long-term retention?",
            "options": [
                "A) Active Recall and Spaced Repetition",
                "B) Highlighting text lines in a textbook",
                "C) Passively re-reading summaries and slide bullet points",
                "D) Group discussion without practice testing"
            ],
            "correct_index": 0,
            "explanation": "Active recall (testing your memory) and spaced repetition (reviewing concepts over expanding time intervals) strengthen synaptic memory pathways."
        },
        {
            "question": "What is Spaced Repetition?",
            "options": [
                "A) Reviewing information at increasing intervals over time to exploit the psychological spacing effect",
                "B) Leaving blank lines in a written paper",
                "C) Reading text in different locations of a room",
                "D) Taking long study breaks during exam weeks"
            ],
            "correct_index": 0,
            "explanation": "Spaced repetition spaces out review sessions so you review a concept right before you are likely to forget it, locking it into long-term memory."
        },
        {
            "question": "What does the term 'Cognitive Load' refer to?",
            "options": [
                "A) The total amount of mental effort being used in the working memory",
                "B) The physical weight of study textbooks",
                "C) The download bandwidth required for virtual classes",
                "D) The CPU load of an AI server"
            ],
            "correct_index": 0,
            "explanation": "Cognitive Load theory details how working memory has limited capacity; overloading it with too much complex data degrades learning efficiency."
        },
        {
            "question": "Why is sleep considered a vital stage of studying?",
            "options": [
                "A) The brain consolidates short-term knowledge into long-term memory during sleep cycles",
                "B) Sleeping clears temporary caches on computer drives",
                "C) Sleep allows eyes to recover from screen glare only",
                "D) There is no cognitive benefit to sleeping after study"
            ],
            "correct_index": 0,
            "explanation": "During sleep, particularly REM and deep sleep stages, the brain replays and consolidates the neural connections formed during learning."
        },
        {
            "question": "What is Mind Mapping?",
            "options": [
                "A) A visual diagram that represents tasks, words, or concepts linked around a central subject",
                "B) Storing geographic maps in memory databases",
                "C) Using AI to read user thoughts",
                "D) A memory training exercise for competitive gamers"
            ],
            "correct_index": 0,
            "explanation": "Mind maps are graphical notes structures that help organize ideas hierarchically, showing associations between components."
        },
        {
            "question": "What is Metacognition?",
            "options": [
                "A) Thinking about, monitoring, and directing one's own cognitive processes and learning",
                "B) Adding metadata columns to MySQL tables",
                "C) Attending virtual reality study rooms",
                "D) A form of query optimization in databases"
            ],
            "correct_index": 0,
            "explanation": "Metacognition is 'thinking about thinking'—being aware of what you know, what you don't know, and how to adapt your studying style."
        },
        {
            "question": "What is the impact of multitasking on academic study performance?",
            "options": [
                "A) It decreases learning efficiency, increases errors, and delays task completion",
                "B) It increases overall study speed with no side effects",
                "C) It improves concentration on complex math problems",
                "D) Multitasking has been proven to have no impact on retention"
            ],
            "correct_index": 0,
            "explanation": "Cognitive switching costs mean that dividing attention between tasks forces the brain to constantly reload context, degrading comprehension."
        },
        {
            "question": "What is the best way to prepare for a practical coding or problem-solving exam?",
            "options": [
                "A) Writing actual code and solving practice problems actively",
                "B) Memorizing syntax cheat-sheets and lists",
                "C) Watching coding video courses passively",
                "D) Reading programming textbooks cover to cover"
            ],
            "correct_index": 0,
            "explanation": "Hands-on application and solving novel problems builds procedural memory, which is essential for encoding software development practices."
        }
    ]
}

def generate_mcq_quiz(pdf_text: str, topic_title: str) -> List[Dict[str, Any]]:
    """
    Generates a 10-question MCQ quiz for a topic.
    Calls Gemini API if available, falls back to local structured quiz banks.
    """
    clean_topic = topic_title.strip().lower()
    
    # 1. Attempt Gemini generation if key exists
    if settings.GEMINI_API_KEY:
        try:
            print(f"[Quiz] Prompting Gemini for MCQ quiz on topic: '{topic_title}'...")
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-2.0-flash")
            
            prompt = f"""
You are an expert academic evaluator. Generate exactly 10 Multiple-Choice Questions (MCQs) testing concepts from the topic "{topic_title}" based on the following notes text.

Grounding Notes text:
\"\"\"
{pdf_text[:30000]}
\"\"\"

Output format:
Return ONLY a valid JSON array of objects. Do not include markdown code block formatting (like ```json), do not include extra text. Just return the raw JSON array.
Each JSON object in the array must match this schema:
{{
  "question": "The question text?",
  "options": [
    "A) Option description",
    "B) Option description",
    "C) Option description",
    "D) Option description"
  ],
  "correct_index": 0, // Integer (0 to 3) representing the index of the correct option in the options array
  "explanation": "Brief explanation of why this option is correct based on the notes."
}}
"""
            response = model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Clean response text in case markdown block formatting is present
            if response_text.startswith("```"):
                response_text = re.sub(r"^```[a-zA-Z]*\n", "", response_text)
                response_text = re.sub(r"\n```$", "", response_text)
                response_text = response_text.strip()
                
            questions = json.loads(response_text)
            if isinstance(questions, list) and len(questions) == 10:
                print(f"[Quiz] Successfully generated 10 MCQs from Gemini on '{topic_title}'.")
                return questions
            else:
                print(f"[Quiz] Gemini output validation failed (length={len(questions) if isinstance(questions, list) else 'not a list'}). Falling back.")
        except Exception as e:
            print(f"[Quiz] Gemini quiz generation failed: {e}. Falling back to program mocks.")

    # 2. Local fallback bank
    print(f"[Quiz] Selecting high-quality fallback quiz bank for '{topic_title}'...")
    selected_category = "generic"
    
    if any(kw in clean_topic for kw in ["operating system", "os", "kernel", "thread", "process", "memory", "cpu"]):
        selected_category = "os"
    elif any(kw in clean_topic for kw in ["dbms", "database", "sql", "query", "relation"]):
        selected_category = "dbms"
    elif any(kw in clean_topic for kw in ["network", "tcp", "ip", "dns", "http", "routing", "port"]):
        selected_category = "network"

    questions = FALLBACK_QUIZZES[selected_category]
    
    # Return a copy to prevent mutation
    return [dict(q) for q in questions]
