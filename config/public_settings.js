// config/settings.js
module.exports = {
  project: {
    name: 'FastoNoSQL',
    name_lowercase: 'fastonosql',
    app_version: '1.9.10',
    app_version_type: 'release'
  },

  site: {
    name: 'FastoNoSQL',
    version: '1.0.0',
    domain: 'https://fastonosql.com',
    keywords: 'FastoNoSQL, GUI Manager, Redis GUI, Memcached GUI, SSDB GUI, LevelDB GUI, RocksDB GUI, LMDB GUI, Unqlite GUI, UpscaleDB GUI, ForestDB GUI',
    description: 'FastoNoSQL it is GUI platform for NoSQL databases.',
    small_description: 'FastoNoSQL - cross-platform GUI Manager for Redis, Memcached, SSDB, RocksDB, LMDB, UpscaleDB, Unqlite and ForestDB databases.',
    large_description: 'FastoNoSQL — is a cross-platform GUI Manager for Redis, Memcached, SSDB, RocksDB, LMDB, UpscaleDB, Unqlite and ForestDB databases(i.e. Admin GUI Client). Our Desktop Client works on the most amount of Linux systems, also on Windows, Mac OS X, FreeBSD and Android platforms.',
    github_link: 'https://github.com/fastogt/fastonosql',
    github_issues_link: 'https://github.com/fastogt/fastonosql/issues',
    github_link_without_host: 'fastogt/fastonosql',
    twitter_name: 'FastoNoSQL',
    twitter_link: 'https://twitter.com/FastoNoSQL',
    supported_databases: [{'name': 'Redis', 'option': 'BUILD_WITH_REDIS'},
      {'name': 'Memcached', 'option': 'BUILD_WITH_MEMCACHED'},
      {'name': 'SSDB', 'option': 'BUILD_WITH_SSDB'},
      {'name': 'LevelDB', 'option': 'BUILD_WITH_LEVELDB'},
      {'name': 'RocksDB', 'option': 'BUILD_WITH_ROCKSDB'},
      {'name': 'LMDB', 'option': 'BUILD_WITH_LMDB'},
      {'name': 'Unqlite', 'option': 'BUILD_WITH_UNQLITE'},
      {'name': 'UpscaleDB', 'option': 'BUILD_WITH_UPSCALEDB'},
      {'name': 'ForestDB', 'option': 'BUILD_WITH_FORESTDB'}]
  },

  support: {
    author: 'Topilski Alexandr',
    contact: 'support@fastogt.com'
  },

  company: {
    name: 'FastoGT',
    description: 'Fasto Great Technology',
    domain: 'http://fastogt.com',
    copyright: 'Copyright © 2014-2017 FastoGT. All rights reserved.'
  }
};

