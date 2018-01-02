// config/settings.js
module.exports = {
    project: {
        name: 'FastoNoSQL',
        name_lowercase: 'fastonosql',
        version: '1.14.3'
    },

    site: {
        name: 'FastoNoSQL',
        version: '1.0.0',
        domain: 'https://fastonosql.com',
        keywords: 'fastonosql, nosql, gui, manager, redis, client, memcached, ssdb, leveldb, rocksdb, lmdb, unqlite, upscaledb, forestdb, admin, tool',
        description: 'FastoNoSQL it is GUI platform for NoSQL databases.',
        small_description: 'FastoNoSQL - cross-platform GUI Manager for Redis, Memcached, SSDB, RocksDB, LMDB, UpscaleDB, Unqlite and ForestDB databases.',
        large_description: 'FastoNoSQL — is a cross-platform GUI Manager for Redis, Memcached, SSDB, RocksDB, LMDB, UpscaleDB, Unqlite and ForestDB databases(i.e. Admin GUI Client). Our Desktop Client works on the most amount of Linux systems, also on Windows, Mac OS X, FreeBSD and Android platforms.',

        github_link: 'https://github.com/fastogt/fastonosql',
        github_issues_link: 'https://github.com/fastogt/fastonosql/issues',
        github_link_without_host: 'fastogt/fastonosql',

        twitter_name: 'FastoNoSQL',
        twitter_link: 'https://twitter.com/FastoNoSQL',

        paypal_token: 'FY5JBFRE6NP9Y',
        google_analitics_token: 'UA-56403848-4',
        //data_ad_client: 'ca-pub-4299795201353238',
        //data_ad_slot: '1261996191',

        supported_databases: [{'name': 'Redis', 'option': 'BUILD_WITH_REDIS', 'active' : true},
            {'name': 'Memcached', 'option': 'BUILD_WITH_MEMCACHED', 'active' : true},
            {'name': 'SSDB', 'option': 'BUILD_WITH_SSDB', 'active' : true},
            {'name': 'LevelDB', 'option': 'BUILD_WITH_LEVELDB', 'active' : true},
            {'name': 'RocksDB', 'option': 'BUILD_WITH_ROCKSDB', 'active' : true},
            {'name': 'LMDB', 'option': 'BUILD_WITH_LMDB', 'active' : true},
            {'name': 'Unqlite', 'option': 'BUILD_WITH_UNQLITE', 'active' : true},
            {'name': 'UpscaleDB', 'option': 'BUILD_WITH_UPSCALEDB', 'active' : false},
            {'name': 'ForestDB', 'option': 'BUILD_WITH_FORESTDB', 'active' : true}]
    },

    support: {
        author: 'Topilski Alexandr',
        contact_mail: 'support@fastogt.com',
        contact_skype: 'support.fastogt'
    },

    company: {
        name: 'FastoGT',
        description: 'Fasto Great Technology',
        domain: 'http://fastogt.com',
        copyright: 'Copyright © 2014-2017 FastoGT. All rights reserved.'
    }
};

