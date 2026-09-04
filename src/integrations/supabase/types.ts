export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          parts: Json | null
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          parts?: Json | null
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parts?: Json | null
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_coach_snapshots: {
        Row: {
          biggest_mistake: string | null
          created_at: string
          focus: string | null
          id: string
          motivation: string | null
          recommendations: Json
          report_id: string | null
          revision_goal: string | null
          sync_summary: Json
          target_score: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          biggest_mistake?: string | null
          created_at?: string
          focus?: string | null
          id?: string
          motivation?: string | null
          recommendations?: Json
          report_id?: string | null
          revision_goal?: string | null
          sync_summary?: Json
          target_score?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          biggest_mistake?: string | null
          created_at?: string
          focus?: string | null
          id?: string
          motivation?: string | null
          recommendations?: Json
          report_id?: string | null
          revision_goal?: string | null
          sync_summary?: Json
          target_score?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_coach_snapshots_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "ai_mock_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_mock_reports: {
        Row: {
          accuracy: number | null
          analysis_generated_at: string | null
          analysis_status: string
          analysis_version: string | null
          attempt_id: string | null
          created_at: string
          data_verified_at: string | null
          detected_chapter: string | null
          detected_subject: string | null
          detected_topic: string | null
          error: string | null
          exam_name: string | null
          file_paths: Json
          id: string
          ocr_text: string | null
          overall_score: number | null
          readiness_score: number | null
          report: Json | null
          report_type: string
          source_test_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          verification_error: string | null
          verified_attempt_snapshot: Json | null
        }
        Insert: {
          accuracy?: number | null
          analysis_generated_at?: string | null
          analysis_status?: string
          analysis_version?: string | null
          attempt_id?: string | null
          created_at?: string
          data_verified_at?: string | null
          detected_chapter?: string | null
          detected_subject?: string | null
          detected_topic?: string | null
          error?: string | null
          exam_name?: string | null
          file_paths?: Json
          id?: string
          ocr_text?: string | null
          overall_score?: number | null
          readiness_score?: number | null
          report?: Json | null
          report_type?: string
          source_test_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id: string
          verification_error?: string | null
          verified_attempt_snapshot?: Json | null
        }
        Update: {
          accuracy?: number | null
          analysis_generated_at?: string | null
          analysis_status?: string
          analysis_version?: string | null
          attempt_id?: string | null
          created_at?: string
          data_verified_at?: string | null
          detected_chapter?: string | null
          detected_subject?: string | null
          detected_topic?: string | null
          error?: string | null
          exam_name?: string | null
          file_paths?: Json
          id?: string
          ocr_text?: string | null
          overall_score?: number | null
          readiness_score?: number | null
          report?: Json | null
          report_type?: string
          source_test_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          verification_error?: string | null
          verified_attempt_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_mock_reports_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_mock_reports_source_test_id_fkey"
            columns: ["source_test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_logs: {
        Row: {
          created_at: string
          error_code: string | null
          fallback_used: boolean
          feature: string | null
          id: string
          model: string | null
          provider: string
          response_time_ms: number
          retry_count: number
          status: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          fallback_used?: boolean
          feature?: string | null
          id?: string
          model?: string | null
          provider: string
          response_time_ms?: number
          retry_count?: number
          status: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          fallback_used?: boolean
          feature?: string | null
          id?: string
          model?: string | null
          provider?: string
          response_time_ms?: number
          retry_count?: number
          status?: string
        }
        Relationships: []
      }
      ai_report_audit_logs: {
        Row: {
          analysis_version: string
          attempt_id: string | null
          consistency_status: string
          data_verification_status: string
          error: string | null
          generated_at: string
          id: string
          report_id: string
          user_id: string
          verified_snapshot: Json
        }
        Insert: {
          analysis_version: string
          attempt_id?: string | null
          consistency_status?: string
          data_verification_status: string
          error?: string | null
          generated_at?: string
          id?: string
          report_id: string
          user_id: string
          verified_snapshot?: Json
        }
        Update: {
          analysis_version?: string
          attempt_id?: string | null
          consistency_status?: string
          data_verification_status?: string
          error?: string | null
          generated_at?: string
          id?: string
          report_id?: string
          user_id?: string
          verified_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_report_audit_logs_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_report_audit_logs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "ai_mock_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      app_intro: {
        Row: {
          created_at: string
          duration_seconds: number
          enabled: boolean
          file_path: string | null
          id: string
          media_kind: string
          mime_type: string | null
          skip_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          enabled?: boolean
          file_path?: string | null
          id?: string
          media_kind?: string
          mime_type?: string | null
          skip_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          enabled?: boolean
          file_path?: string | null
          id?: string
          media_kind?: string
          mime_type?: string | null
          skip_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      app_release: {
        Row: {
          created_at: string
          file_path: string | null
          file_size: number | null
          id: string
          notes: string | null
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          notes?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          notes?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          subject_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          subject_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          subject_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chapter_views: {
        Row: {
          chapter_id: string
          id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          chapter_id: string
          id?: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          chapter_id?: string
          id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_views_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          created_at: string
          id: string
          name: string
          name_hi: string | null
          sort_order: number
          subject_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_hi?: string | null
          sort_order?: number
          subject_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_hi?: string | null
          sort_order?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reviews: {
        Row: {
          analysis: string | null
          consistency_label: string | null
          consistency_score: number
          created_at: string
          id: string
          mentor_message: string | null
          metrics: Json | null
          review_date: string
          seriousness_level: string | null
          seriousness_reasons: Json | null
          targets_completed: number
          targets_total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: string | null
          consistency_label?: string | null
          consistency_score?: number
          created_at?: string
          id?: string
          mentor_message?: string | null
          metrics?: Json | null
          review_date?: string
          seriousness_level?: string | null
          seriousness_reasons?: Json | null
          targets_completed?: number
          targets_total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: string | null
          consistency_label?: string | null
          consistency_score?: number
          created_at?: string
          id?: string
          mentor_message?: string | null
          metrics?: Json | null
          review_date?: string
          seriousness_level?: string | null
          seriousness_reasons?: Json | null
          targets_completed?: number
          targets_total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_targets: {
        Row: {
          category: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          priority: string
          sort_order: number
          target_date: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          priority?: string
          sort_order?: number
          target_date?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          priority?: string
          sort_order?: number
          target_date?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback_media: {
        Row: {
          category: string
          created_at: string
          enabled: boolean
          file_path: string
          id: string
          label: string | null
          media_type: string
          mime_type: string | null
        }
        Insert: {
          category: string
          created_at?: string
          enabled?: boolean
          file_path: string
          id?: string
          label?: string | null
          media_type: string
          mime_type?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          enabled?: boolean
          file_path?: string
          id?: string
          label?: string | null
          media_type?: string
          mime_type?: string | null
        }
        Relationships: []
      }
      feedback_settings: {
        Row: {
          animation_duration_ms: number
          animation_enabled: boolean
          category_flags: Json
          created_at: string
          id: string
          random_playback: boolean
          updated_at: string
          voice_enabled: boolean
          volume: number
        }
        Insert: {
          animation_duration_ms?: number
          animation_enabled?: boolean
          category_flags?: Json
          created_at?: string
          id?: string
          random_playback?: boolean
          updated_at?: string
          voice_enabled?: boolean
          volume?: number
        }
        Update: {
          animation_duration_ms?: number
          animation_enabled?: boolean
          category_flags?: Json
          created_at?: string
          id?: string
          random_playback?: boolean
          updated_at?: string
          voice_enabled?: boolean
          volume?: number
        }
        Relationships: []
      }
      imported_auto_tests: {
        Row: {
          chapter: string | null
          created_at: string
          difficulty_curve: string | null
          id: string
          item_count: number
          items: Json
          kind: string
          meta: Json
          priority: string
          report_id: string
          subject: string | null
          subtopic: string | null
          title: string
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter?: string | null
          created_at?: string
          difficulty_curve?: string | null
          id?: string
          item_count?: number
          items?: Json
          kind: string
          meta?: Json
          priority?: string
          report_id: string
          subject?: string | null
          subtopic?: string | null
          title: string
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter?: string | null
          created_at?: string
          difficulty_curve?: string | null
          id?: string
          item_count?: number
          items?: Json
          kind?: string
          meta?: Json
          priority?: string
          report_id?: string
          subject?: string | null
          subtopic?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "imported_auto_tests_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "imported_mock_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_coach_memory: {
        Row: {
          last_report_id: string | null
          memory: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          last_report_id?: string | null
          memory?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          last_report_id?: string | null
          memory?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      imported_mock_reports: {
        Row: {
          accuracy: number | null
          attempt_percent: number | null
          created_at: string
          exam_readiness: string | null
          extracted: Json
          extraction_error: string | null
          extraction_status: string
          id: string
          mock_name: string | null
          negative_marks: number | null
          original_text: string
          overall_rank: number | null
          percentile: number | null
          report_number: number
          score: number | null
          section_scores: Json | null
          source_ai: string | null
          time_used: string | null
          updated_at: string
          user_id: string
          verdict: string | null
        }
        Insert: {
          accuracy?: number | null
          attempt_percent?: number | null
          created_at?: string
          exam_readiness?: string | null
          extracted?: Json
          extraction_error?: string | null
          extraction_status?: string
          id?: string
          mock_name?: string | null
          negative_marks?: number | null
          original_text: string
          overall_rank?: number | null
          percentile?: number | null
          report_number?: number
          score?: number | null
          section_scores?: Json | null
          source_ai?: string | null
          time_used?: string | null
          updated_at?: string
          user_id: string
          verdict?: string | null
        }
        Update: {
          accuracy?: number | null
          attempt_percent?: number | null
          created_at?: string
          exam_readiness?: string | null
          extracted?: Json
          extraction_error?: string | null
          extraction_status?: string
          id?: string
          mock_name?: string | null
          negative_marks?: number | null
          original_text?: string
          overall_rank?: number | null
          percentile?: number | null
          report_number?: number
          score?: number | null
          section_scores?: Json | null
          source_ai?: string | null
          time_used?: string | null
          updated_at?: string
          user_id?: string
          verdict?: string | null
        }
        Relationships: []
      }
      imported_report_insights: {
        Row: {
          action_plan_3day: Json
          additional_insights: Json | null
          calculation_errors: Json
          conceptual_errors: Json
          created_at: string
          critical_topics: Json
          declining_topics: Json | null
          deep_analysis_error: string | null
          deep_analysis_status: string
          guesswork: Json
          hierarchy: Json
          high_roi_chapters: Json
          high_roi_topics: Json
          id: string
          improving_topics: Json | null
          learning_repository: Json | null
          mistake_bank: Json | null
          next_mock_strategy: Json
          patterns: Json
          question_level: Json | null
          reading_errors: Json
          recurring: Json
          red_flags: Json
          report_id: string
          revision_priority: Json
          scores: Json
          silly_mistakes: Json
          skipped_bank: Json | null
          strengths: Json
          strong_chapters: Json
          strong_subjects: Json
          strong_topics: Json
          time_problems: Json
          updated_at: string
          user_id: string
          weak_chapters: Json
          weak_subjects: Json
          weak_topics: Json
          weaknesses: Json
        }
        Insert: {
          action_plan_3day?: Json
          additional_insights?: Json | null
          calculation_errors?: Json
          conceptual_errors?: Json
          created_at?: string
          critical_topics?: Json
          declining_topics?: Json | null
          deep_analysis_error?: string | null
          deep_analysis_status?: string
          guesswork?: Json
          hierarchy?: Json
          high_roi_chapters?: Json
          high_roi_topics?: Json
          id?: string
          improving_topics?: Json | null
          learning_repository?: Json | null
          mistake_bank?: Json | null
          next_mock_strategy?: Json
          patterns?: Json
          question_level?: Json | null
          reading_errors?: Json
          recurring?: Json
          red_flags?: Json
          report_id: string
          revision_priority?: Json
          scores?: Json
          silly_mistakes?: Json
          skipped_bank?: Json | null
          strengths?: Json
          strong_chapters?: Json
          strong_subjects?: Json
          strong_topics?: Json
          time_problems?: Json
          updated_at?: string
          user_id: string
          weak_chapters?: Json
          weak_subjects?: Json
          weak_topics?: Json
          weaknesses?: Json
        }
        Update: {
          action_plan_3day?: Json
          additional_insights?: Json | null
          calculation_errors?: Json
          conceptual_errors?: Json
          created_at?: string
          critical_topics?: Json
          declining_topics?: Json | null
          deep_analysis_error?: string | null
          deep_analysis_status?: string
          guesswork?: Json
          hierarchy?: Json
          high_roi_chapters?: Json
          high_roi_topics?: Json
          id?: string
          improving_topics?: Json | null
          learning_repository?: Json | null
          mistake_bank?: Json | null
          next_mock_strategy?: Json
          patterns?: Json
          question_level?: Json | null
          reading_errors?: Json
          recurring?: Json
          red_flags?: Json
          report_id?: string
          revision_priority?: Json
          scores?: Json
          silly_mistakes?: Json
          skipped_bank?: Json | null
          strengths?: Json
          strong_chapters?: Json
          strong_subjects?: Json
          strong_topics?: Json
          time_problems?: Json
          updated_at?: string
          user_id?: string
          weak_chapters?: Json
          weak_subjects?: Json
          weak_topics?: Json
          weaknesses?: Json
        }
        Relationships: [
          {
            foreignKeyName: "imported_report_insights_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "imported_mock_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      mistake_dna: {
        Row: {
          distribution: Json
          last_attempt_id: string | null
          timeline: Json
          totals: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          distribution?: Json
          last_attempt_id?: string | null
          timeline?: Json
          totals?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          distribution?: Json
          last_attempt_id?: string | null
          timeline?: Json
          totals?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mock_classification_job_items: {
        Row: {
          ai_chapter: string | null
          ai_subject: string | null
          ai_subtopic: string | null
          ai_topic: string | null
          attempts: number
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_id: string
          provider: string | null
          question_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_chapter?: string | null
          ai_subject?: string | null
          ai_subtopic?: string | null
          ai_topic?: string | null
          attempts?: number
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_id: string
          provider?: string | null
          question_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_chapter?: string | null
          ai_subject?: string | null
          ai_subtopic?: string | null
          ai_topic?: string | null
          attempts?: number
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_id?: string
          provider?: string | null
          question_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_classification_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "mock_classification_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_classification_job_items_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "mock_mistake_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_classification_jobs: {
        Row: {
          completed_at: string | null
          completed_questions: number
          created_at: string
          current_question: number
          current_question_id: string | null
          error_message: string | null
          failed_questions: number
          heartbeat_at: string | null
          hierarchy_version: string
          id: string
          lease_expires_at: string | null
          lease_token: string | null
          mock_id: string | null
          retry_count: number
          scope_key: string
          scope_type: string
          skipped_questions: number
          started_at: string | null
          status: string
          subject: string
          total_questions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_questions?: number
          created_at?: string
          current_question?: number
          current_question_id?: string | null
          error_message?: string | null
          failed_questions?: number
          heartbeat_at?: string | null
          hierarchy_version: string
          id?: string
          lease_expires_at?: string | null
          lease_token?: string | null
          mock_id?: string | null
          retry_count?: number
          scope_key: string
          scope_type: string
          skipped_questions?: number
          started_at?: string | null
          status?: string
          subject: string
          total_questions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_questions?: number
          created_at?: string
          current_question?: number
          current_question_id?: string | null
          error_message?: string | null
          failed_questions?: number
          heartbeat_at?: string | null
          hierarchy_version?: string
          id?: string
          lease_expires_at?: string | null
          lease_token?: string | null
          mock_id?: string | null
          retry_count?: number
          scope_key?: string
          scope_type?: string
          skipped_questions?: number
          started_at?: string | null
          status?: string
          subject?: string
          total_questions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_classification_jobs_current_question_id_fkey"
            columns: ["current_question_id"]
            isOneToOne: false
            referencedRelation: "mock_mistake_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_classification_jobs_mock_id_fkey"
            columns: ["mock_id"]
            isOneToOne: false
            referencedRelation: "mock_mistake_mocks"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_generated_questions: {
        Row: {
          chapter: string | null
          correct_option: string | null
          created_at: string
          explanation: string | null
          has_options: boolean
          id: string
          marked_option: string | null
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          original_status: string | null
          q_no: number | null
          question_text: string
          report_id: string
          sort_order: number
          subject: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          chapter?: string | null
          correct_option?: string | null
          created_at?: string
          explanation?: string | null
          has_options?: boolean
          id?: string
          marked_option?: string | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          original_status?: string | null
          q_no?: number | null
          question_text: string
          report_id: string
          sort_order?: number
          subject?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          chapter?: string | null
          correct_option?: string | null
          created_at?: string
          explanation?: string | null
          has_options?: boolean
          id?: string
          marked_option?: string | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          original_status?: string | null
          q_no?: number | null
          question_text?: string
          report_id?: string
          sort_order?: number
          subject?: string | null
          topic?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_generated_questions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "ai_mock_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_mistake_action_completions: {
        Row: {
          action_key: string
          completed_at: string
          id: string
          snapshot: Json
          title: string | null
          user_id: string
        }
        Insert: {
          action_key: string
          completed_at?: string
          id?: string
          snapshot?: Json
          title?: string | null
          user_id: string
        }
        Update: {
          action_key?: string
          completed_at?: string
          id?: string
          snapshot?: Json
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mock_mistake_action_plans: {
        Row: {
          created_at: string
          error: string | null
          evidence: Json | null
          generated_at: string | null
          id: string
          plan: Json | null
          questions_analyzed: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          evidence?: Json | null
          generated_at?: string | null
          id?: string
          plan?: Json | null
          questions_analyzed?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          evidence?: Json | null
          generated_at?: string | null
          id?: string
          plan?: Json | null
          questions_analyzed?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mock_mistake_ai_memory: {
        Row: {
          advice: string | null
          area: string | null
          evidence: Json | null
          first_seen_at: string
          id: string
          kind: string | null
          last_seen_at: string
          occurrences: number
          pattern_key: string
          severity: string | null
          subject: string | null
          summary: string | null
          user_id: string
        }
        Insert: {
          advice?: string | null
          area?: string | null
          evidence?: Json | null
          first_seen_at?: string
          id?: string
          kind?: string | null
          last_seen_at?: string
          occurrences?: number
          pattern_key: string
          severity?: string | null
          subject?: string | null
          summary?: string | null
          user_id: string
        }
        Update: {
          advice?: string | null
          area?: string | null
          evidence?: Json | null
          first_seen_at?: string
          id?: string
          kind?: string | null
          last_seen_at?: string
          occurrences?: number
          pattern_key?: string
          severity?: string | null
          subject?: string | null
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mock_mistake_intelligence: {
        Row: {
          created_at: string
          error: string | null
          evidence: Json | null
          generated_at: string | null
          id: string
          questions_analyzed: number
          report: Json | null
          signature: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          evidence?: Json | null
          generated_at?: string | null
          id?: string
          questions_analyzed?: number
          report?: Json | null
          signature?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          evidence?: Json | null
          generated_at?: string | null
          id?: string
          questions_analyzed?: number
          report?: Json | null
          signature?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mock_mistake_mocks: {
        Row: {
          created_at: string
          id: string
          name: string
          organize_error: string | null
          organize_message: string | null
          organize_progress: number
          organize_status: string
          organize_total: number
          organized_at: string | null
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organize_error?: string | null
          organize_message?: string | null
          organize_progress?: number
          organize_status?: string
          organize_total?: number
          organized_at?: string | null
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organize_error?: string | null
          organize_message?: string | null
          organize_progress?: number
          organize_status?: string
          organize_total?: number
          organized_at?: string | null
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mock_mistake_questions: {
        Row: {
          ai_chapter: string | null
          ai_subject: string | null
          ai_subtopic: string | null
          ai_topic: string | null
          chapter: string | null
          classification_id: string | null
          classification_status: string
          classification_version: string | null
          classified_at: string | null
          correct_answer: string | null
          correct_count: number
          created_at: string
          explanation: string | null
          id: string
          last_practice_at: string | null
          mastered: boolean
          mock_id: string
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          practice_count: number
          question_text: string
          sort_order: number
          source_status: string
          topic: string | null
          updated_at: string
          user_answer: string | null
          user_id: string
          wrong_count: number
        }
        Insert: {
          ai_chapter?: string | null
          ai_subject?: string | null
          ai_subtopic?: string | null
          ai_topic?: string | null
          chapter?: string | null
          classification_id?: string | null
          classification_status?: string
          classification_version?: string | null
          classified_at?: string | null
          correct_answer?: string | null
          correct_count?: number
          created_at?: string
          explanation?: string | null
          id?: string
          last_practice_at?: string | null
          mastered?: boolean
          mock_id: string
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          practice_count?: number
          question_text: string
          sort_order?: number
          source_status?: string
          topic?: string | null
          updated_at?: string
          user_answer?: string | null
          user_id: string
          wrong_count?: number
        }
        Update: {
          ai_chapter?: string | null
          ai_subject?: string | null
          ai_subtopic?: string | null
          ai_topic?: string | null
          chapter?: string | null
          classification_id?: string | null
          classification_status?: string
          classification_version?: string | null
          classified_at?: string | null
          correct_answer?: string | null
          correct_count?: number
          created_at?: string
          explanation?: string | null
          id?: string
          last_practice_at?: string | null
          mastered?: boolean
          mock_id?: string
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          practice_count?: number
          question_text?: string
          sort_order?: number
          source_status?: string
          topic?: string | null
          updated_at?: string
          user_answer?: string | null
          user_id?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "mock_mistake_questions_mock_id_fkey"
            columns: ["mock_id"]
            isOneToOne: false
            referencedRelation: "mock_mistake_mocks"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          chapter_id: string
          content: string
          created_at: string
          id: string
          subject_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          content?: string
          created_at?: string
          id?: string
          subject_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          content?: string
          created_at?: string
          id?: string
          subject_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pdf_progress: {
        Row: {
          id: string
          last_page: number
          pdf_id: string
          status: string
          subject_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          last_page?: number
          pdf_id: string
          status?: string
          subject_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          last_page?: number
          pdf_id?: string
          status?: string
          subject_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pdfs: {
        Row: {
          chapter_id: string | null
          created_at: string
          description: string | null
          file_path: string
          id: string
          subject_id: string | null
          title: string
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          description?: string | null
          file_path: string
          id?: string
          subject_id?: string | null
          title: string
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          description?: string | null
          file_path?: string
          id?: string
          subject_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdfs_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdfs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      performance: {
        Row: {
          chapter_id: string | null
          created_at: string
          id: string
          image_path: string | null
          subject_id: string | null
          text_content: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          subject_id?: string | null
          text_content?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          subject_id?: string | null
          text_content?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          answers: Json
          chapter: string | null
          created_at: string
          current_index: number
          current_question_id: string | null
          elapsed_seconds: number
          id: string
          last_saved_at: string
          marked: Json
          option_order: Json
          question_ids: Json
          remaining_seconds: number | null
          shuffle_mode: boolean
          skipped: Json
          source: string
          source_key: string
          status: string
          subject: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          chapter?: string | null
          created_at?: string
          current_index?: number
          current_question_id?: string | null
          elapsed_seconds?: number
          id?: string
          last_saved_at?: string
          marked?: Json
          option_order?: Json
          question_ids?: Json
          remaining_seconds?: number | null
          shuffle_mode?: boolean
          skipped?: Json
          source: string
          source_key: string
          status?: string
          subject?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          chapter?: string | null
          created_at?: string
          current_index?: number
          current_question_id?: string | null
          elapsed_seconds?: number
          id?: string
          last_saved_at?: string
          marked?: Json
          option_order?: Json
          question_ids?: Json
          remaining_seconds?: number | null
          shuffle_mode?: boolean
          skipped?: Json
          source?: string
          source_key?: string
          status?: string
          subject?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      question_similarity_reports: {
        Row: {
          admin_status: string
          ai_recommendation: string | null
          generated_at: string
          id: string
          matches: Json
          question_id: string
          test_id: string | null
          top_match_score: number
          top_match_status: string
          updated_at: string
          variant_type: string | null
        }
        Insert: {
          admin_status?: string
          ai_recommendation?: string | null
          generated_at?: string
          id?: string
          matches?: Json
          question_id: string
          test_id?: string | null
          top_match_score?: number
          top_match_status?: string
          updated_at?: string
          variant_type?: string | null
        }
        Update: {
          admin_status?: string
          ai_recommendation?: string | null
          generated_at?: string
          id?: string
          matches?: Json
          question_id?: string
          test_id?: string | null
          top_match_score?: number
          top_match_status?: string
          updated_at?: string
          variant_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_similarity_reports_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          admin_reviewed: boolean
          ai_analysis: Json | null
          ai_analyzed_at: string | null
          ai_confidence: number | null
          ai_issues: Json
          attachments: Json
          bloom_level: string | null
          chapter_id: string | null
          complexity_score: number | null
          concept: string | null
          content_hash: string | null
          correct_option: string
          created_at: string
          difficulty: string | null
          embedded_at: string | null
          embedding: string | null
          embedding_model: string | null
          exam_level: string | null
          expected_time_seconds: number | null
          explanation: string | null
          id: string
          importance: string | null
          marks: number
          negative_marks: number
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          quality_score: number | null
          question_image_url: string | null
          question_text: string
          sort_order: number
          subtopic: string | null
          test_id: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          admin_reviewed?: boolean
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          ai_confidence?: number | null
          ai_issues?: Json
          attachments?: Json
          bloom_level?: string | null
          chapter_id?: string | null
          complexity_score?: number | null
          concept?: string | null
          content_hash?: string | null
          correct_option: string
          created_at?: string
          difficulty?: string | null
          embedded_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          exam_level?: string | null
          expected_time_seconds?: number | null
          explanation?: string | null
          id?: string
          importance?: string | null
          marks?: number
          negative_marks?: number
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          quality_score?: number | null
          question_image_url?: string | null
          question_text: string
          sort_order?: number
          subtopic?: string | null
          test_id: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          admin_reviewed?: boolean
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          ai_confidence?: number | null
          ai_issues?: Json
          attachments?: Json
          bloom_level?: string | null
          chapter_id?: string | null
          complexity_score?: number | null
          concept?: string | null
          content_hash?: string | null
          correct_option?: string
          created_at?: string
          difficulty?: string | null
          embedded_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          exam_level?: string | null
          expected_time_seconds?: number | null
          explanation?: string | null
          id?: string
          importance?: string | null
          marks?: number
          negative_marks?: number
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          quality_score?: number | null
          question_image_url?: string | null
          question_text?: string
          sort_order?: number
          subtopic?: string | null
          test_id?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          answers: Json | null
          correct_count: number
          created_at: string
          id: string
          score: number
          test_id: string
          time_taken_seconds: number | null
          total_marks: number
          total_questions: number
          user_id: string
        }
        Insert: {
          answers?: Json | null
          correct_count?: number
          created_at?: string
          id?: string
          score?: number
          test_id: string
          time_taken_seconds?: number | null
          total_marks?: number
          total_questions?: number
          user_id: string
        }
        Update: {
          answers?: Json | null
          correct_count?: number
          created_at?: string
          id?: string
          score?: number
          test_id?: string
          time_taken_seconds?: number | null
          total_marks?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      revision_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          subject_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          subject_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          subject_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      revision_practice_attempts: {
        Row: {
          accuracy: number
          ai_analysis: string | null
          ai_comparison: string | null
          chapter: string | null
          correct_count: number
          created_at: string
          details: Json
          id: string
          shuffle_mode: boolean
          skipped_count: number
          source: string
          source_key: string
          subject: string | null
          time_taken_seconds: number
          title: string
          total_questions: number
          updated_at: string
          user_id: string
          wrong_count: number
        }
        Insert: {
          accuracy?: number
          ai_analysis?: string | null
          ai_comparison?: string | null
          chapter?: string | null
          correct_count?: number
          created_at?: string
          details?: Json
          id?: string
          shuffle_mode?: boolean
          skipped_count?: number
          source: string
          source_key: string
          subject?: string | null
          time_taken_seconds?: number
          title?: string
          total_questions?: number
          updated_at?: string
          user_id: string
          wrong_count?: number
        }
        Update: {
          accuracy?: number
          ai_analysis?: string | null
          ai_comparison?: string | null
          chapter?: string | null
          correct_count?: number
          created_at?: string
          details?: Json
          id?: string
          shuffle_mode?: boolean
          skipped_count?: number
          source?: string
          source_key?: string
          subject?: string | null
          time_taken_seconds?: number
          title?: string
          total_questions?: number
          updated_at?: string
          user_id?: string
          wrong_count?: number
        }
        Relationships: []
      }
      revision_tests: {
        Row: {
          chapter_id: string | null
          created_at: string
          id: string
          question_count: number
          question_ids: Json
          subject_id: string | null
          test_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          id?: string
          question_count?: number
          question_ids?: Json
          subject_id?: string | null
          test_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          id?: string
          question_count?: number
          question_ids?: Json
          subject_id?: string | null
          test_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revision_tests_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_goals: {
        Row: {
          created_at: string
          current_value: number
          deadline: string | null
          description: string | null
          id: string
          report_id: string | null
          status: string
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          deadline?: string | null
          description?: string | null
          id?: string
          report_id?: string | null
          status?: string
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: number
          deadline?: string | null
          description?: string | null
          id?: string
          report_id?: string | null
          status?: string
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_goals_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "ai_mock_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      study_activity: {
        Row: {
          id: string
          item_id: string
          item_type: string
          opened_at: string
          subject_id: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          id?: string
          item_id: string
          item_type: string
          opened_at?: string
          subject_id?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          id?: string
          item_id?: string
          item_type?: string
          opened_at?: string
          subject_id?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      study_plan_tasks: {
        Row: {
          chapter: string | null
          completed_at: string | null
          created_at: string
          day_index: number | null
          description: string | null
          estimated_minutes: number
          id: string
          practice_questions: number
          priority: string
          report_id: string | null
          revision_minutes: number
          scope: string
          status: string
          subject: string | null
          task_date: string | null
          title: string
          topic: string | null
          updated_at: string
          user_id: string
          week_index: number | null
        }
        Insert: {
          chapter?: string | null
          completed_at?: string | null
          created_at?: string
          day_index?: number | null
          description?: string | null
          estimated_minutes?: number
          id?: string
          practice_questions?: number
          priority?: string
          report_id?: string | null
          revision_minutes?: number
          scope?: string
          status?: string
          subject?: string | null
          task_date?: string | null
          title: string
          topic?: string | null
          updated_at?: string
          user_id: string
          week_index?: number | null
        }
        Update: {
          chapter?: string | null
          completed_at?: string | null
          created_at?: string
          day_index?: number | null
          description?: string | null
          estimated_minutes?: number
          id?: string
          practice_questions?: number
          priority?: string
          report_id?: string | null
          revision_minutes?: number
          scope?: string
          status?: string
          subject?: string | null
          task_date?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
          week_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "study_plan_tasks_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "ai_mock_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          cover_image: string | null
          created_at: string
          description: string | null
          id: string
          is_pinned: boolean
          is_popular: boolean
          name: string
          name_hi: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_pinned?: boolean
          is_popular?: boolean
          name: string
          name_hi?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_pinned?: boolean
          is_popular?: boolean
          name?: string
          name_hi?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      syllabus_chapters: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          subject_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          subject_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          subject_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syllabus_chapters_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "syllabus_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabus_subjects: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          linked_subject_id: string | null
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          linked_subject_id?: string | null
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          linked_subject_id?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      syllabus_timeline: {
        Row: {
          chapter_id: string | null
          created_at: string
          event_type: string
          id: string
          note: string | null
          subject_id: string | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          note?: string | null
          subject_id?: string | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          note?: string | null
          subject_id?: string | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syllabus_timeline_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "syllabus_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabus_topics: {
        Row: {
          chapter_id: string
          completed_at: string | null
          created_at: string
          estimated_classes: number | null
          estimated_hours: number | null
          estimated_pages: number | null
          estimated_revisions: number | null
          id: string
          last_activity_at: string | null
          name: string
          notes: string | null
          priority: string
          resources: Json
          revision_count: number
          sort_order: number
          status: string
          subject_id: string
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          completed_at?: string | null
          created_at?: string
          estimated_classes?: number | null
          estimated_hours?: number | null
          estimated_pages?: number | null
          estimated_revisions?: number | null
          id?: string
          last_activity_at?: string | null
          name: string
          notes?: string | null
          priority?: string
          resources?: Json
          revision_count?: number
          sort_order?: number
          status?: string
          subject_id: string
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          completed_at?: string | null
          created_at?: string
          estimated_classes?: number | null
          estimated_hours?: number | null
          estimated_pages?: number | null
          estimated_revisions?: number | null
          id?: string
          last_activity_at?: string | null
          name?: string
          notes?: string | null
          priority?: string
          resources?: Json
          revision_count?: number
          sort_order?: number
          status?: string
          subject_id?: string
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syllabus_topics_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "syllabus_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syllabus_topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "syllabus_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      test_attempts: {
        Row: {
          accuracy: number
          answers: Json | null
          correct_count: number
          created_at: string
          current_index: number
          guesses: Json
          id: string
          incorrect_count: number
          marked: Json | null
          marks_obtained: number
          mode: string
          shuffle_mode: boolean
          skipped_count: number
          status: string
          test_id: string
          time_taken_seconds: number
          total_questions: number
          unattempted_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number
          answers?: Json | null
          correct_count?: number
          created_at?: string
          current_index?: number
          guesses?: Json
          id?: string
          incorrect_count?: number
          marked?: Json | null
          marks_obtained?: number
          mode?: string
          shuffle_mode?: boolean
          skipped_count?: number
          status?: string
          test_id: string
          time_taken_seconds?: number
          total_questions?: number
          unattempted_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number
          answers?: Json | null
          correct_count?: number
          created_at?: string
          current_index?: number
          guesses?: Json
          id?: string
          incorrect_count?: number
          marked?: Json | null
          marks_obtained?: number
          mode?: string
          shuffle_mode?: boolean
          skipped_count?: number
          status?: string
          test_id?: string
          time_taken_seconds?: number
          total_questions?: number
          unattempted_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_edit_history: {
        Row: {
          action: string
          changed_fields: string[]
          created_at: string
          diff: Json
          edited_by: string | null
          id: string
          note: string | null
          question_id: string | null
          test_id: string
        }
        Insert: {
          action: string
          changed_fields?: string[]
          created_at?: string
          diff?: Json
          edited_by?: string | null
          id?: string
          note?: string | null
          question_id?: string | null
          test_id: string
        }
        Update: {
          action?: string
          changed_fields?: string[]
          created_at?: string
          diff?: Json
          edited_by?: string | null
          id?: string
          note?: string | null
          question_id?: string | null
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_edit_history_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_edit_history_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_mistake_analyses: {
        Row: {
          action_plan: Json
          attempt_id: string
          coach_summary: string | null
          created_at: string
          hindi_report: Json
          id: string
          improvements: Json
          memory_analysis: Json
          mistake_distribution: Json
          model: string | null
          overall: Json
          question_analyses: Json
          related_learning: Json
          repeated_weaknesses: Json
          subject_id: string | null
          test_id: string | null
          thinking_profile: Json
          time_analysis: Json
          topic_breakdown: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          action_plan?: Json
          attempt_id: string
          coach_summary?: string | null
          created_at?: string
          hindi_report?: Json
          id?: string
          improvements?: Json
          memory_analysis?: Json
          mistake_distribution?: Json
          model?: string | null
          overall?: Json
          question_analyses?: Json
          related_learning?: Json
          repeated_weaknesses?: Json
          subject_id?: string | null
          test_id?: string | null
          thinking_profile?: Json
          time_analysis?: Json
          topic_breakdown?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          action_plan?: Json
          attempt_id?: string
          coach_summary?: string | null
          created_at?: string
          hindi_report?: Json
          id?: string
          improvements?: Json
          memory_analysis?: Json
          mistake_distribution?: Json
          model?: string | null
          overall?: Json
          question_analyses?: Json
          related_learning?: Json
          repeated_weaknesses?: Json
          subject_id?: string | null
          test_id?: string | null
          thinking_profile?: Json
          time_analysis?: Json
          topic_breakdown?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_mistake_analyses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          ai_analysis_status: string
          ai_analysis_summary: Json | null
          ai_analyzed_at: string | null
          chapter_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_published: boolean
          subject_id: string | null
          test_link: string | null
          test_part: string | null
          title: string
          total_marks: number | null
          total_questions: number | null
          updated_at: string
        }
        Insert: {
          ai_analysis_status?: string
          ai_analysis_summary?: Json | null
          ai_analyzed_at?: string | null
          chapter_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_published?: boolean
          subject_id?: string | null
          test_link?: string | null
          test_part?: string | null
          title: string
          total_marks?: number | null
          total_questions?: number | null
          updated_at?: string
        }
        Update: {
          ai_analysis_status?: string
          ai_analysis_summary?: Json | null
          ai_analyzed_at?: string | null
          chapter_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_published?: boolean
          subject_id?: string | null
          test_link?: string | null
          test_part?: string | null
          title?: string
          total_marks?: number | null
          total_questions?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tests_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tests_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          code: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          code: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          code?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_exam_targets: {
        Row: {
          created_at: string
          exam_date: string | null
          exam_name: string
          id: string
          target_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_date?: string | null
          exam_name: string
          id?: string
          target_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exam_date?: string | null
          exam_name?: string
          id?: string
          target_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_goals: {
        Row: {
          created_at: string
          target_accuracy: number | null
          target_readiness: number | null
          target_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          target_accuracy?: number | null
          target_readiness?: number | null
          target_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          target_accuracy?: number | null
          target_readiness?: number | null
          target_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wrong_questions: {
        Row: {
          chapter_id: string | null
          consecutive_correct: number
          correct_option: string | null
          correct_revision_count: number
          created_at: string
          difficulty: string | null
          explanation: string | null
          first_wrong_at: string | null
          id: string
          image_path: string | null
          is_active: boolean
          is_guess: boolean
          is_marked: boolean
          is_skipped: boolean
          last_attempt_at: string | null
          last_attempt_result: string | null
          last_practiced_at: string | null
          last_wrong_at: string | null
          mastered_at: string | null
          mastery_score: number
          mastery_status: string
          mistake_type: string | null
          note: string | null
          practice_attempts: number
          practice_correct_count: number
          priority: string
          question_id: string | null
          question_text: string | null
          question_type: string | null
          selected_option: string | null
          source: string
          source_report_id: string | null
          source_type: string
          status: string
          sub_topic: string | null
          subject_id: string | null
          test_id: string | null
          test_name: string | null
          test_part: string | null
          topic: string | null
          total_attempts: number
          total_correct: number
          total_skipped: number
          total_wrong: number
          updated_at: string
          user_id: string
          wrong_count: number
        }
        Insert: {
          chapter_id?: string | null
          consecutive_correct?: number
          correct_option?: string | null
          correct_revision_count?: number
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          first_wrong_at?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          is_guess?: boolean
          is_marked?: boolean
          is_skipped?: boolean
          last_attempt_at?: string | null
          last_attempt_result?: string | null
          last_practiced_at?: string | null
          last_wrong_at?: string | null
          mastered_at?: string | null
          mastery_score?: number
          mastery_status?: string
          mistake_type?: string | null
          note?: string | null
          practice_attempts?: number
          practice_correct_count?: number
          priority?: string
          question_id?: string | null
          question_text?: string | null
          question_type?: string | null
          selected_option?: string | null
          source?: string
          source_report_id?: string | null
          source_type?: string
          status?: string
          sub_topic?: string | null
          subject_id?: string | null
          test_id?: string | null
          test_name?: string | null
          test_part?: string | null
          topic?: string | null
          total_attempts?: number
          total_correct?: number
          total_skipped?: number
          total_wrong?: number
          updated_at?: string
          user_id: string
          wrong_count?: number
        }
        Update: {
          chapter_id?: string | null
          consecutive_correct?: number
          correct_option?: string | null
          correct_revision_count?: number
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          first_wrong_at?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          is_guess?: boolean
          is_marked?: boolean
          is_skipped?: boolean
          last_attempt_at?: string | null
          last_attempt_result?: string | null
          last_practiced_at?: string | null
          last_wrong_at?: string | null
          mastered_at?: string | null
          mastery_score?: number
          mastery_status?: string
          mistake_type?: string | null
          note?: string | null
          practice_attempts?: number
          practice_correct_count?: number
          priority?: string
          question_id?: string | null
          question_text?: string | null
          question_type?: string | null
          selected_option?: string | null
          source?: string
          source_report_id?: string | null
          source_type?: string
          status?: string
          sub_topic?: string | null
          subject_id?: string | null
          test_id?: string | null
          test_name?: string | null
          test_part?: string | null
          topic?: string | null
          total_attempts?: number
          total_correct?: number
          total_skipped?: number
          total_wrong?: number
          updated_at?: string
          user_id?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "wrong_questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_questions_source_report_id_fkey"
            columns: ["source_report_id"]
            isOneToOne: false
            referencedRelation: "ai_mock_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_user_emails: {
        Args: { _user_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      claim_mock_classification_job: {
        Args: { _job_id: string; _lease_seconds?: number; _lease_token: string }
        Returns: boolean
      }
      complete_mock_classification_item: {
        Args: {
          _ai_chapter: string
          _ai_subject: string
          _ai_subtopic: string
          _ai_topic: string
          _hierarchy_version: string
          _item_id: string
          _job_id: string
          _lease_token: string
          _provider?: string
        }
        Returns: boolean
      }
      fail_mock_classification_item: {
        Args: {
          _error_message: string
          _item_id: string
          _job_id: string
          _lease_token: string
        }
        Returns: boolean
      }
      finalize_mock_classification_job: {
        Args: { _job_id: string; _lease_token: string }
        Returns: string
      }
      get_test_accuracy_leaderboard: {
        Args: { _test_id: string }
        Returns: {
          accuracy: number
          display_name: string
          is_me: boolean
          rank: number
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_questions: {
        Args: {
          exclude_ids?: string[]
          match_count?: number
          query_embedding: string
        }
        Returns: {
          concept: string
          correct_option: string
          created_at: string
          difficulty: string
          exam_level: string
          id: string
          question_text: string
          similarity: number
          test_id: string
          topic: string
        }[]
      }
      verify_ai_mock_report_data: {
        Args: {
          _accuracy: number
          _attempt_id?: string
          _correct: number
          _negative_marks?: number
          _report_id: string
          _score: number
          _skipped: number
          _source_test_id?: string
          _submitted_at: string
          _time_taken_seconds: number
          _total_marks: number
          _wrong: number
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "student"],
    },
  },
} as const
