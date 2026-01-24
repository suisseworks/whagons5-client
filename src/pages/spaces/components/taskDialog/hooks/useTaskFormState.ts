import { useState, useRef } from 'react';

export function useTaskFormState() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [priorityId, setPriorityId] = useState<number | null>(null);
  const [spotId, setSpotId] = useState<number | null>(null);
  const [statusId, setStatusId] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [dueTime, setDueTime] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [slaId, setSlaId] = useState<number | null>(null);
  const [approvalId, setApprovalId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [showDescription, setShowDescription] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sharing state
  const [shareTeamId, setShareTeamId] = useState<number | null>(null);
  const [shareUserId, setShareUserId] = useState<number | null>(null);
  const [sharePermission, setSharePermission] = useState<'COMMENT_ATTACH' | 'STATUS_TRACKING'>('STATUS_TRACKING');
  const [shareTargetType, setShareTargetType] = useState<'user' | 'team'>('team');
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [sharesRefreshKey, setSharesRefreshKey] = useState(0);

  const formInitializedRef = useRef(false);

  return {
    name, setName,
    description, setDescription,
    categoryId, setCategoryId,
    priorityId, setPriorityId,
    spotId, setSpotId,
    statusId, setStatusId,
    templateId, setTemplateId,
    startDate, setStartDate,
    startTime, setStartTime,
    dueDate, setDueDate,
    dueTime, setDueTime,
    selectedUserIds, setSelectedUserIds,
    slaId, setSlaId,
    approvalId, setApprovalId,
    activeTab, setActiveTab,
    showDescription, setShowDescription,
    selectedTagIds, setSelectedTagIds,
    isSubmitting, setIsSubmitting,
    shareTeamId, setShareTeamId,
    shareUserId, setShareUserId,
    sharePermission, setSharePermission,
    shareTargetType, setShareTargetType,
    shareBusy, setShareBusy,
    shareError, setShareError,
    shareSuccess, setShareSuccess,
    sharesRefreshKey, setSharesRefreshKey,
    formInitializedRef,
  };
}
