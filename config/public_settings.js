// config/settings.js
module.exports = {
    project: {
        name: 'FastoNoSQL',
        name_lowercase: 'fastonosql',
        version: '2.5.1',
        domain: 'fastonosql.com',
        trial_days: 10,
        price_per_month: 9.99,
        price_per_6_month: 54.99,
        price_per_year: 99.99,
        price_permanent: 499.99
    },

    site: {
        name: 'FastoNoSQL',
        version: '1.1.0',
        domain: 'https://fastonosql.com',
        keywords: 'fastonosql, nosql, gui, manager, redis, client, memcached, ssdb, leveldb, rocksdb, lmdb, unqlite, forestdb, pika, dynomite, keydb, admin, tool',
        description: 'FastoNoSQL - GUI manager for NoSQL databases.',
        small_description: 'FastoNoSQL - cross-platform GUI Manager for Redis, Memcached, SSDB, LevelDB, RocksDB, LMDB, Unqlite, ForestDB, Pika, Dynomite and KeyDB databases.',
        large_description: 'FastoNoSQL - is a cross-platform GUI Manager for Redis, Memcached, SSDB, LevelDB, RocksDB, LMDB, Unqlite, ForestDB, Pika, Dynomite and KeyDB databases(i.e. Admin GUI Client). Our Desktop Client works on the most amount of Linux systems, also on Windows, Mac OS X, FreeBSD and Android platforms.',

        github_link: 'https://github.com/fastogt/fastonosql',
        github_issues_link: 'https://github.com/fastogt/fastonosql/issues',
        github_link_without_host: 'fastogt/fastonosql',
        discord_group: 'https://discord.gg/DzPyGxG',

        google_analitics_token: 'UA-56403848-4',

        supported_databases: [{'name': 'Redis', 'option': 'BUILD_WITH_REDIS', 'active': true},
            {'name': 'Memcached', 'option': 'BUILD_WITH_MEMCACHED', 'active': true},
            {'name': 'SSDB', 'option': 'BUILD_WITH_SSDB', 'active': true},
            {'name': 'LevelDB', 'option': 'BUILD_WITH_LEVELDB', 'active': true},
            {'name': 'RocksDB', 'option': 'BUILD_WITH_ROCKSDB', 'active': true},
            {'name': 'LMDB', 'option': 'BUILD_WITH_LMDB', 'active': true},
            {'name': 'Unqlite', 'option': 'BUILD_WITH_UNQLITE', 'active': true},
            {'name': 'ForestDB', 'option': 'BUILD_WITH_FORESTDB', 'active': false},
            {'name': 'Pika', 'option': 'BUILD_WITH_PIKA', 'active': false},
            {'name': 'Dynomite', 'option': 'BUILD_WITH_DYNOMITE', 'active': false},
            {'name': 'KeyDB', 'option': 'BUILD_WITH_KEYDB', 'active': true}]
    },

    support: {
        author: 'Alexandr Topilski',
        contact_email: 'support@fastogt.com'
    },

    company: {
        name: 'FastoGT',
        description: 'Fasto Great Technology',
        domain: 'http://fastogt.com',
        copyright: 'Copyright © 2014-2019 FastoGT. All rights reserved.'
    }
};

