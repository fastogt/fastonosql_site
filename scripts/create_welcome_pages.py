#!/usr/bin/env python3

import os
from shutil import copyfile
from config import versions, welcome_file_name, welcome_file_pro_name, welcome_file_extension

welcome_app_folder = '../public/welcome_app'
welcome_app_pro_folder = '../public/welcome_app_pro'
welcome_app_enterprise_folder = '../public/welcome_app_enterprise'

if __name__ == "__main__":
    master_file = os.path.abspath(welcome_file_name + '.' + welcome_file_extension)
    master_file_pro = os.path.abspath(welcome_file_pro_name + '.' + welcome_file_extension)

    for version in versions:
        welcome_file_path = os.path.join(welcome_app_folder, version + '.' + welcome_file_extension)
        welcome_file_path_absolute = os.path.abspath(welcome_file_path)
        copyfile(master_file, welcome_file_path_absolute)
        print(welcome_file_path_absolute)

        welcome_file_pro_path = os.path.join(welcome_app_pro_folder, version + '.' + welcome_file_extension)
        welcome_file_pro_path_absolute = os.path.abspath(welcome_file_pro_path)
        copyfile(master_file_pro, welcome_file_pro_path_absolute)
        print(welcome_file_pro_path_absolute)

        welcome_file_enterprise_path = os.path.join(welcome_app_enterprise_folder, version + '.' + welcome_file_extension)
        welcome_file_enterprise_path_absolute = os.path.abspath(welcome_file_enterprise_path)
        copyfile(master_file_pro, welcome_file_enterprise_path_absolute)
        print(welcome_file_enterprise_path_absolute)
