#!/usr/bin/env python3

import sys
from shutil import copyfile
import os


def print_usage():
    print('Usage:\n'
          '[required] argv[1] master file\n'
          '[required] argv[2] folder to patch\n')


if __name__ == "__main__":
    argc = len(sys.argv)

    if argc <= 2:
        print_usage()
        sys.exit(1)

    master_file = os.path.abspath(sys.argv[1])
    folder_to_patch = os.path.abspath(sys.argv[2])

    if not os.path.isfile(master_file):
        print('Invalid master file path: {0}\n'.format(master_file))
        sys.exit(1)

    if not os.path.isdir(folder_to_patch):
        print('Invalid folder path: {0}\n'.format(folder_to_patch))
        sys.exit(1)

    for file in os.listdir(folder_to_patch):
        old_file_path = os.path.join(folder_to_patch, file)
        copyfile(master_file, old_file_path)
        print('Updated file: {0}\n'.format(old_file_path))
