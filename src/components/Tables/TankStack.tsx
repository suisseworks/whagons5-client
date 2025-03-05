import * as React from "react";
const { useState, useRef, useMemo } = React;
import {
  useReactTable,
  ColumnDef,
  ColumnSort,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

type Person = {
  id: number;
  name: string;
  age: number;
  city: string;
  email: string;
};

const generateData = (count: number): Person[] => {
  const firstNames = [
    "James",
    "Mary",
    "John",
    "Patricia",
    "Robert",
    "Jennifer",
    "Michael",
    "Linda",
    "William",
    "Elizabeth"
  ];
  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Wilson",
    "Martinez"
  ];
  const cities = [
    "New York",
    "Los Angeles",
    "Chicago",
    "Houston",
    "Phoenix",
    "Philadelphia"
  ];
  const domains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"];

  return Array.from({ length: count }, (_, i) => {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(
      Math.random() * 10000
    )}@${domain}`;

    return {
      id: i + 1,
      name: `${firstName} ${lastName}`,
      age: Math.floor(Math.random() * (65 - 18 + 1)) + 18,
      city,
      email,
    };
  });
};

const TankStack = () => {
  const [data] = useState<Person[]>(generateData(1000));
  const [sorting, setSorting] = useState<ColumnSort[]>([]);

  const columns = useMemo<ColumnDef<Person>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        size: 200,
        enableSorting: true,
      },
      {
        accessorKey: "age",
        header: "Age",
        size: 100,
        enableSorting: true,
      },
      {
        accessorKey: "city",
        header: "City",
        size: 150,
        enableSorting: true,
      },
      {
        accessorKey: "email",
        header: "Email",
        size: 350,
        enableSorting: true,
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: "onChange",
    enableSorting: true,
    enableMultiSort: true,
  });

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    getScrollElement: () => parentRef.current,
    count: table.getRowModel().rows.length,
    estimateSize: () => 44,
    overscan: 5,
  });

  return (
    <div className="relative min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl overflow-hidden shadow-lg dark:bg-gray-700">
          {/* Header Section */}
          <div className="shadow-sm relative rounded-t-2xl bg-gray-100 dark:bg-gray-600">
            {table.getHeaderGroups().map((headerGroup: any) => (
              <div key={headerGroup.id} className="flex">
                {headerGroup.headers.map((header: any) => (
                  <div
                    key={header.id}
                    className="py-4 px-6 text-left text-sm font-bold uppercase tracking-wider cursor-pointer transition-colors duration-200 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 relative"
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ width: `${header.getSize()}px` }}
                  >
                    <div
                      className="flex items-center space-x-2"
                      style={{ position: "relative", width: "100%" }}
                    >
                      <span>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </span>
                      <span className="text-blue-500 dark:text-blue-400">
                        {header.column.getIsSorted() &&
                          (header.column.getIsSorted() === "asc" ? " ↑" : " ↓")}
                      </span>
                    </div>
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className="absolute right-0 top-0 h-full w-1 bg-gray-300 dark:bg-gray-600 cursor-col-resize hover:bg-gray-400 dark:hover:bg-gray-500 touch-none shadow-[0_0_8px_rgba(0,0,0,0.1)]"
                      style={{
                        transform: header.column.getIsResizing()
                          ? "translateX(0px)"
                          : "translateX(50%)",
                      }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Virtualized Body Section */}
          <div
            ref={parentRef}
            className="bg-white dark:bg-gray-700 custom-scroll"
            style={{ height: "600px", overflow: "auto" }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                const row = table.getRowModel().rows[virtualItem.index];
                return (
                  <div
                    key={row.id}
                    className="transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <div className="flex h-full items-center border-b border-gray-200 dark:border-gray-700">
                      {row.getVisibleCells().map((cell: any) => (
                        <div
                          key={cell.id}
                          style={{
                            width: `${cell.column.getSize()}px`,
                            padding: "0.875rem 1.5rem",
                          }}
                          className="truncate font-medium text-gray-700 dark:text-gray-300"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TankStack;
