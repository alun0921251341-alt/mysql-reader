#!/usr/bin/env python3
"""
MySQL Users Reader - 獨立腳本版本
可以不依賴 API 直接讀取和記錄資料
"""

import mysql.connector
from datetime import datetime
import json
import argparse
import logging

# 設定日誌
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MySQLReader:
    def __init__(self, db_config):
        self.db_config = db_config
        self.connection = None
    
    def connect(self):
        """連接到資料庫"""
        try:
            self.connection = mysql.connector.connect(**self.db_config)
            logger.info("資料庫連線成功")
            return True
        except mysql.connector.Error as err:
            logger.error(f"資料庫連線失敗: {err}")
            return False
    
    def disconnect(self):
        """斷開資料庫連線"""
        if self.connection and self.connection.is_connected():
            self.connection.close()
            logger.info("資料庫連線已關閉")
    
    def init_log_table(self):
        """初始化記錄表"""
        if not self.connection:
            logger.error("資料庫未連線")
            return False
        
        try:
            cursor = self.connection.cursor()
            create_table_sql = """
            CREATE TABLE IF NOT EXISTS user_read_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                userid VARCHAR(255) NOT NULL,
                shopid VARCHAR(255),
                read_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                read_count INT DEFAULT 1,
                last_read_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                source VARCHAR(50) DEFAULT 'python_script',
                INDEX idx_userid (userid),
                INDEX idx_read_time (read_time),
                UNIQUE KEY unique_userid (userid)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
            cursor.execute(create_table_sql)
            self.connection.commit()
            logger.info("記錄表初始化完成")
            return True
        except mysql.connector.Error as err:
            logger.error(f"建立記錄表失敗: {err}")
            return False
        finally:
            cursor.close()
    
    def read_users(self, limit=100, offset=0):
        """讀取用戶資料"""
        if not self.connection:
            logger.error("資料庫未連線")
            return []
        
        try:
            cursor = self.connection.cursor(dictionary=True)
            query = "SELECT * FROM users_filtered_with_shopid LIMIT %s OFFSET %s"
            cursor.execute(query, (limit, offset))
            users = cursor.fetchall()
            
            # 轉換日期時間為字串
            for user in users:
                for key, value in user.items():
                    if isinstance(value, datetime):
                        user[key] = value.isoformat()
            
            logger.info(f"成功讀取 {len(users)} 筆用戶資料")
            return users
            
        except mysql.connector.Error as err:
            logger.error(f"讀取用戶資料失敗: {err}")
            return []
        finally:
            cursor.close()
    
    def log_read_activity(self, users):
        """記錄讀取活動"""
        if not self.connection or not users:
            return False
        
        try:
            cursor = self.connection.cursor()
            
            for user in users:
                userid = user.get('userid')
                author_shopid = user.get('author_shopid')
                
                if userid:
                    insert_sql = """
                    INSERT INTO user_read_logs (userid, author_shopid, read_time, read_count, source)
                    VALUES (%s, %s, NOW(), 1, 'python_script')
                    ON DUPLICATE KEY UPDATE
                    read_count = read_count + 1,
                    last_read_time = NOW(),
                    author_shopid = VALUES(author_shopid)
                    """
                    cursor.execute(insert_sql, (userid, author_shopid))
            
            self.connection.commit()
            logger.info(f"成功記錄 {len(users)} 筆讀取活動")
            return True
            
        except mysql.connector.Error as err:
            logger.error(f"記錄讀取活動失敗: {err}")
            self.connection.rollback()
            return False
        finally:
            cursor.close()
    
    def get_statistics(self):
        """取得統計資料"""
        if not self.connection:
            return {}
        
        try:
            cursor = self.connection.cursor(dictionary=True)
            
            stats_sql = """
            SELECT 
                COUNT(DISTINCT userid) as total_users,
                SUM(read_count) as total_reads,
                MAX(last_read_time) as last_read_time,
                MIN(read_time) as first_read_time
            FROM user_read_logs
            """
            cursor.execute(stats_sql)
            stats = cursor.fetchone()
            
            # 轉換日期時間
            for key, value in stats.items():
                if isinstance(value, datetime):
                    stats[key] = value.isoformat()
                elif value is None:
                    stats[key] = 0
            
            return stats
            
        except mysql.connector.Error as err:
            logger.error(f"取得統計失敗: {err}")
            return {}
        finally:
            cursor.close()

def main():
    parser = argparse.ArgumentParser(description='MySQL Users Reader')
    parser.add_argument('--limit', type=int, default=100, help='讀取筆數限制')
    parser.add_argument('--offset', type=int, default=0, help='偏移量')
    parser.add_argument('--stats', action='store_true', help='只顯示統計資料')
    parser.add_argument('--output', type=str, help='輸出到檔案')
    
    args = parser.parse_args()
    
    # 資料庫設定 - 請修改這裡
    db_config = {
        'host': 'localhost',
        'user': 'your_username',       # 請修改
        'password': 'your_password',   # 請修改
        'database': 'your_database',   # 請修改
        'port': 3306
    }
    
    # 建立讀取器實例
    reader = MySQLReader(db_config)
    
    try:
        # 連接資料庫
        if not reader.connect():
            return
        
        # 初始化記錄表
        reader.init_log_table()
        
        if args.stats:
            # 只顯示統計
            stats = reader.get_statistics()
            print("📊 統計資料:")
            print(json.dumps(stats, indent=2, ensure_ascii=False))
        else:
            # 讀取用戶資料
            print(f"🔍 讀取用戶資料 (limit={args.limit}, offset={args.offset})")
            users = reader.read_users(args.limit, args.offset)
            
            if users:
                # 記錄讀取活動
                reader.log_read_activity(users)
                
                # 輸出結果
                result = {
                    'timestamp': datetime.now().isoformat(),
                    'count': len(users),
                    'users': users
                }
                
                if args.output:
                    with open(args.output, 'w', encoding='utf-8') as f:
                        json.dump(result, f, indent=2, ensure_ascii=False)
                    print(f"📄 結果已輸出到: {args.output}")
                else:
                    print("📄 讀取結果:")
                    print(json.dumps(result, indent=2, ensure_ascii=False))
                
                # 顯示統計
                stats = reader.get_statistics()
                print("\n📊 統計資料:")
                print(json.dumps(stats, indent=2, ensure_ascii=False))
            else:
                print("❌ 沒有讀取到任何資料")
    
    finally:
        reader.disconnect()

if __name__ == '__main__':
    main()